import { env } from "cloudflare:workers";
import { getConfig } from "./discord-auth";

type ResourceRow = { tournamentId: string; guildId: string; roleId: string | null; channelId: string | null; announcementChannelId: string | null; announcementMessageId: string | null; provisionStatus: string; lastError: string; cleanupAt?: string | null };
type Tournament = { id: string; name: string; notice: string; startAt: string; rounds: number };

const values = () => env as unknown as Record<string, unknown>;

async function discordRequest(path: string, init: RequestInit = {}) {
  const token = values().DISCORD_BOT_TOKEN;
  if (typeof token !== "string" || !token) throw new Error("DISCORD_BOT_TOKENが未設定です");
  const response = await fetch(`https://discord.com/api/v10${path}`, { ...init, headers: { authorization: `Bot ${token}`, "content-type": "application/json", ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`Discord API ${path} が失敗しました（HTTP ${response.status}）`);
  return response.status === 204 ? null : await response.json() as Record<string, unknown>;
}

async function save(db: D1Database, tournamentId: string, patch: Partial<{ roleId: string | null; channelId: string | null; announcementChannelId: string | null; announcementMessageId: string | null; provisionStatus: string; lastError: string; retryAt: string | null }>) {
  const entries = Object.entries(patch);
  if (!entries.length) return;
  const columns = entries.map(([key]) => ({ roleId: "role_id", channelId: "channel_id", announcementChannelId: "announcement_channel_id", announcementMessageId: "announcement_message_id", provisionStatus: "provision_status", lastError: "last_error", retryAt: "retry_at", cleanupAt: "cleanup_at" } as Record<string, string>)[key]);
  await db.prepare(`UPDATE tournament_discord_resources SET ${columns.map((column) => `${column} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE tournament_id = ?`).bind(...entries.map(([, value]) => value), tournamentId).run();
}

export async function provisionTournamentResources(tournamentId: string) {
  if (!env.DB) throw new Error("D1 binding is unavailable");
  const config = getConfig();
  if (!config.guildId || !config.operatorRoleId || !config.announcementChannelId) throw new Error("Discord Guild・運営ロール・告知チャンネルの設定が必要です");
  const tournament = await env.DB.prepare("SELECT id, name, notice, start_at as startAt, rounds FROM tournaments WHERE id = ?").bind(tournamentId).first<Tournament>();
  if (!tournament) throw new Error("大会が見つかりません");
  await env.DB.prepare("INSERT OR IGNORE INTO tournament_discord_resources (tournament_id, guild_id, announcement_channel_id, provision_status) VALUES (?, ?, ?, 'draft')").bind(tournamentId, config.guildId, config.announcementChannelId).run();
  let row = await env.DB.prepare("SELECT tournament_id as tournamentId, guild_id as guildId, role_id as roleId, channel_id as channelId, announcement_channel_id as announcementChannelId, announcement_message_id as announcementMessageId, provision_status as provisionStatus, last_error as lastError, cleanup_at as cleanupAt FROM tournament_discord_resources WHERE tournament_id = ?").bind(tournamentId).first<ResourceRow>();
  if (!row) throw new Error("大会Discord資源台帳を作成できませんでした");
  await save(env.DB, tournamentId, { provisionStatus: "provisioning", lastError: "", retryAt: null });
  try {
    if (!row.roleId) {
      const role = await discordRequest(`/guilds/${config.guildId}/roles`, { method: "POST", body: JSON.stringify({ name: `大会｜${tournament.name}`.slice(0, 100), mentionable: true, permissions: "0" }) });
      row = { ...row, roleId: String(role?.id ?? "") };
      if (!row.roleId) throw new Error("大会ロールIDを取得できませんでした");
      await save(env.DB, tournamentId, { roleId: row.roleId });
    }
    if (!row.channelId) {
      const everyone = config.guildId;
      const overwrites = [{ id: everyone, type: 0, allow: "0", deny: "1024" }, { id: row.roleId, type: 0, allow: "3072", deny: "0" }, { id: config.operatorRoleId, type: 0, allow: "3072", deny: "0" }];
      const channel = await discordRequest(`/guilds/${config.guildId}/channels`, { method: "POST", body: JSON.stringify({ name: `大会-${tournament.id}`.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 90), type: 0, permission_overwrites: overwrites }) });
      row = { ...row, channelId: String(channel?.id ?? "") };
      if (!row.channelId) throw new Error("大会チャンネルIDを取得できませんでした");
      await save(env.DB, tournamentId, { channelId: row.channelId });
    }
    if (!row.announcementMessageId) {
      const message = await discordRequest(`/channels/${row.announcementChannelId ?? config.announcementChannelId}/messages`, { method: "POST", body: JSON.stringify({ content: `【大会参加受付】${tournament.name}\n${tournament.notice || "大会の参加申請はボタンから行ってください。"}\n大会ID: ${tournament.id}`, components: [{ type: 1, components: [{ type: 2, style: 3, label: "参加メニュー", custom_id: "janmatch:menu" }] }], allowed_mentions: { parse: [] } }) });
      row = { ...row, announcementMessageId: String(message?.id ?? "") };
      if (!row.announcementMessageId) throw new Error("大会告知メッセージIDを取得できませんでした");
      await save(env.DB, tournamentId, { announcementMessageId: row.announcementMessageId });
    }
    const cleanupAt = new Date(new Date(tournament.startAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await save(env.DB, tournamentId, { provisionStatus: "published", cleanupAt });
    return { tournamentId, roleId: row.roleId, channelId: row.channelId, announcementChannelId: row.announcementChannelId ?? config.announcementChannelId, announcementMessageId: row.announcementMessageId, status: "published" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discord資源作成に失敗しました";
    await save(env.DB, tournamentId, { provisionStatus: "failed", lastError: message, retryAt: new Date(Date.now() + 60_000).toISOString() });
    throw new Error(message);
  }
}

export async function runDiscordResourceLifecycle() {
  if (!env.DB) return { provisioned: 0, cleaned: 0, retried: 0 };
  const now = Date.now();
  const due = await env.DB.prepare("SELECT id, start_at as startAt FROM tournaments WHERE phase = 'before'").all<{ id: string; startAt: string }>();
  let provisioned = 0;
  const retries = await env.DB.prepare("SELECT tournament_id as tournamentId, user_id as userId, desired_state as desiredState FROM tournament_role_sync WHERE status = 'failed' AND (retry_at IS NULL OR julianday(retry_at) <= julianday('now')) LIMIT 50").all<{ tournamentId: string; userId: string; desiredState: string }>();
  let retried = 0;
  for (const item of retries.results) { await syncTournamentRole(item.tournamentId, item.userId, item.desiredState === "joined"); retried += 1; }
  for (const tournament of due.results) {
    const start = Date.parse(tournament.startAt);
    if (Number.isFinite(start) && start > now && start - now <= 3 * 60 * 60 * 1000) {
      try { await provisionTournamentResources(tournament.id); provisioned += 1; } catch (error) { console.warn(`Discord資源の事前作成に失敗: ${tournament.id}`, error); }
    }
  }
  const cleanup = await env.DB.prepare("SELECT tournament_id as tournamentId, role_id as roleId, channel_id as channelId, guild_id as guildId FROM tournament_discord_resources WHERE provision_status = 'published' AND cleanup_at IS NOT NULL AND julianday(cleanup_at) <= julianday('now')").all<{ tournamentId: string; roleId: string | null; channelId: string | null; guildId: string }>();
  let cleaned = 0;
  for (const resource of cleanup.results) {
    try {
      if (resource.channelId) await discordRequest(`/channels/${resource.channelId}`, { method: "DELETE" });
      if (resource.roleId) await discordRequest(`/guilds/${resource.guildId}/roles/${resource.roleId}`, { method: "DELETE" });
      await env.DB.prepare("UPDATE tournament_discord_resources SET provision_status = 'cleaned', updated_at = CURRENT_TIMESTAMP WHERE tournament_id = ?").bind(resource.tournamentId).run();
      cleaned += 1;
    } catch (error) {
      await env.DB.prepare("UPDATE tournament_discord_resources SET provision_status = 'failed', last_error = ?, retry_at = ?, updated_at = CURRENT_TIMESTAMP WHERE tournament_id = ?").bind(error instanceof Error ? error.message : "Discord資源の削除に失敗しました", new Date(Date.now() + 60_000).toISOString(), resource.tournamentId).run();
    }
  }
  return { provisioned, cleaned, retried };
}

export async function syncTournamentRole(tournamentId: string, userId: string, joined: boolean) {
  if (!env.DB) throw new Error("D1 binding is unavailable");
  const desiredState = joined ? "joined" : "removed";
  await env.DB.prepare("INSERT INTO tournament_role_sync (tournament_id, user_id, desired_state, status, last_error, retry_at, updated_at) VALUES (?, ?, ?, 'pending', '', NULL, CURRENT_TIMESTAMP) ON CONFLICT(tournament_id, user_id) DO UPDATE SET desired_state = excluded.desired_state, status = 'pending', last_error = '', retry_at = NULL, updated_at = CURRENT_TIMESTAMP").bind(tournamentId, userId, desiredState).run();
  try {
    const config = getConfig();
    const resource = await env.DB.prepare("SELECT role_id as roleId FROM tournament_discord_resources WHERE tournament_id = ? AND provision_status = 'published'").bind(tournamentId).first<{ roleId: string | null }>();
    if (!config.guildId || !resource?.roleId) throw new Error("大会ロールが未作成です");
    const path = `/guilds/${config.guildId}/members/${userId}/roles/${resource.roleId}`;
    await discordRequest(path, { method: joined ? "PUT" : "DELETE", body: joined ? undefined : undefined });
    await env.DB.prepare("UPDATE tournament_role_sync SET status = 'synced', last_error = '', retry_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE tournament_id = ? AND user_id = ?").bind(tournamentId, userId).run();
    return { status: "synced" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "大会ロール同期に失敗しました";
    await env.DB.prepare("UPDATE tournament_role_sync SET status = 'failed', last_error = ?, retry_at = ?, updated_at = CURRENT_TIMESTAMP WHERE tournament_id = ? AND user_id = ?").bind(message, new Date(Date.now() + 60_000).toISOString(), tournamentId, userId).run();
    return { status: "failed" as const, error: message };
  }
}
