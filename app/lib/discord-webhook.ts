import { env } from "cloudflare:workers";

type TournamentNotice = { id: string; name: string; startAt: string; rounds: number };

function webhookUrl() {
  const value = env as unknown as Record<string, unknown>;
  return typeof value.DISCORD_WEBHOOK_URL === "string" ? value.DISCORD_WEBHOOK_URL.trim() : "";
}

function appLink(request: Request, tournamentId: string) {
  const value = env as unknown as Record<string, unknown>;
  const origin = typeof value.APP_ORIGIN === "string" && value.APP_ORIGIN ? value.APP_ORIGIN : new URL(request.url).origin;
  return new URL(`/tournaments/${encodeURIComponent(tournamentId)}`, origin).toString();
}

async function claim(db: D1Database, eventKey: string, tournamentId: string, round: number, eventType: string) {
  const result = await db.prepare("INSERT OR IGNORE INTO tournament_notifications (event_key, tournament_id, round, event_type) VALUES (?, ?, ?, ?)").bind(eventKey, tournamentId, round, eventType).run();
  return result.meta.changes > 0;
}

export async function notifyTournament(request: Request, notice: TournamentNotice, round: number, eventType: string, message: string) {
  const url = webhookUrl();
  if (!url) { console.warn(`Discord Webhook未設定: ${notice.id}:${round}:${eventType}`); return false; }
  const eventKey = `${notice.id}:${round}:${eventType}`;
  if (!await claim(env.DB, eventKey, notice.id, round, eventType)) return true;
  const resource = await env.DB.prepare("SELECT role_id as roleId FROM tournament_discord_resources WHERE tournament_id = ? AND provision_status = 'published'").bind(notice.id).first<{ roleId: string | null }>();
  const content = `${resource?.roleId ? `<@&${resource.roleId}> ` : ""}${message}\n${notice.name} / ${round}回戦\n${appLink(request, notice.id)}`;
  try {
    const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, allowed_mentions: resource?.roleId ? { roles: [resource.roleId] } : { parse: [] } }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  } catch (error) {
    await env.DB.prepare("DELETE FROM tournament_notifications WHERE event_key = ?").bind(eventKey).run();
    console.error(`Discord Webhook送信失敗: ${eventKey} (${error instanceof Error ? error.message : "unknown error"})`);
    return false;
  }
}

export async function getTournamentNotice(tournamentId: string): Promise<TournamentNotice | null> {
  return env.DB.prepare("SELECT id, name, start_at as startAt, rounds FROM tournaments WHERE id = ?").bind(tournamentId).first<TournamentNotice>();
}
