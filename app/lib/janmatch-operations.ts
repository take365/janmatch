import { env } from "cloudflare:workers";
import { GET as getState, PUT as putState } from "../api/tournaments/state/route";
import { POST as postEntry } from "../api/tournaments/entries/route";
import { POST as postTournament } from "../api/tournaments/route";
import { beginOperation, finishOperation, requestConfirmation } from "./operation-audit";
import { getConfig } from "./discord-auth";

export type JanmatchActor = { discordUserId: string; guildId?: string; channelId?: string; interactionId?: string; roles?: string[] };
export type OperationArgs = { tournamentId?: string; round?: number; tableIndex?: number; expectedVersion?: number; joined?: boolean; roomId?: string; scores?: number[]; deadline?: number; name?: string; gameType?: string; startAt?: string; rounds?: number; pairingMode?: string; uma?: number[]; password?: string; notice?: string; confirmed?: boolean };

async function notifyOperator(actor: JanmatchActor, operation: string, args: OperationArgs) {
  const config = getConfig();
  if (!config.operatorChannelId || !config.botToken) return;
  const detail = args.notice?.trim() || JSON.stringify({ tournamentId: args.tournamentId, round: args.round, roomId: args.roomId, scores: args.scores });
  const response = await fetch(`https://discord.com/api/v10/channels/${config.operatorChannelId}/messages`, { method: "POST", headers: { authorization: `Bot ${config.botToken}`, "content-type": "application/json" }, body: JSON.stringify({ content: `【JanMatch申告】<@${actor.discordUserId}> / ${operation}\n${detail}` }) });
  if (!response.ok) throw new Error(`運営チャンネルへの転送に失敗しました（${response.status}）`);
}

const jsonRequest = (url: string, method: string, actor: JanmatchActor, body?: unknown) => {
  const values = env as unknown as Record<string, unknown>; const secret = typeof values.DISCORD_INTERNAL_SECRET === "string" ? values.DISCORD_INTERNAL_SECRET : "";
  return new Request(url, { method, headers: { "content-type": "application/json", "x-janmatch-internal-secret": secret, "x-janmatch-discord-user-id": actor.discordUserId }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
};

const readState = async (actor: JanmatchActor, tournamentId: string) => getState(new Request(`http://internal/api/tournaments/state?tournamentId=${encodeURIComponent(tournamentId)}`, { headers: { "x-janmatch-internal-secret": String((env as unknown as Record<string, unknown>).DISCORD_INTERNAL_SECRET ?? ""), "x-janmatch-discord-user-id": actor.discordUserId } }));
const readJson = async (response: Response) => await response.json() as Record<string, unknown>;

export async function executeJanmatchOperation(actor: JanmatchActor, operation: string, args: OperationArgs, existingAuditId?: string) {
  if (!env.DB) throw new Error("D1 binding is unavailable");
  const audit = existingAuditId ? { id: existingAuditId, status: "received", afterSummary: "", errorMessage: "", duplicate: false } : await beginOperation({ interactionId: actor.interactionId, actorUserId: actor.discordUserId, actorDiscordUserId: actor.discordUserId, guildId: actor.guildId, channelId: actor.channelId, roles: actor.roles }, operation, "", JSON.stringify(args));
  const auditId = audit.id;
  if (audit.duplicate) return { ok: audit.status === "completed", data: audit.afterSummary || audit.errorMessage };
  try {
    const operatorOnly = new Set(["create_tournament", "start", "confirm", "schedule_round", "cancel_schedule"]);
    const operatorRoleId = getConfig().operatorRoleId;
    if (operatorOnly.has(operation) && (!operatorRoleId || !actor.roles?.includes(operatorRoleId))) throw new Error("運営ロールが未設定、または付与されていないため操作できません");
    const writeOperation = new Set(["join_round", "cancel_round", "create_tournament", "start", "confirm", "set_room_id", "set_scores", "approve_result", "schedule_round", "cancel_schedule"]);
    if (writeOperation.has(operation) && !args.confirmed) {
      const token = crypto.randomUUID();
      await requestConfirmation(auditId, token, new Date(Date.now() + 5 * 60_000).toISOString());
      return { ok: true, requiresConfirmation: true, message: `この操作を実行するには確認が必要です。[[JANMATCH_CONFIRM:${token}]]` };
    }
    if (operation === "contact_operator" || operation === "report_edit") {
      if (!args.notice?.trim()) throw new Error("問い合わせ内容が必要です");
      await notifyOperator(actor, operation, args);
      await finishOperation(auditId, "completed", JSON.stringify({ operation, notified: Boolean(getConfig().operatorChannelId) }));
      return { ok: true, data: { message: getConfig().operatorChannelId ? "運営へ申告を転送しました。" : "申告を監査ログへ記録しました。運営通知先は未設定です。" } };
    }
    let response: Response;
    if (operation === "list_tournaments") {
      const result = await env.DB.prepare("SELECT id, name, start_at as startAt, phase, rounds FROM tournaments ORDER BY start_at ASC LIMIT 20").all();
      await finishOperation(auditId, "completed", JSON.stringify({ count: result.results.length })); return { ok: true, data: result.results };
    }
    if (operation === "get_tournament_state") {
      if (!args.tournamentId) throw new Error("大会IDが必要です");
      const state = await readJson(await readState(actor, args.tournamentId));
      await finishOperation(auditId, "completed", JSON.stringify({ tournamentId: args.tournamentId })); return { ok: true, data: state };
    }
    if (operation === "join_round" || operation === "cancel_round") {
      if (!args.tournamentId || !Number.isInteger(args.round)) throw new Error("大会IDと回戦が必要です");
      response = await postEntry(jsonRequest("http://internal/api/tournaments/entries", "POST", actor, { tournamentId: args.tournamentId, round: args.round, joined: operation === "join_round" }));
    } else if (operation === "create_tournament") {
      if (!args.name || !args.gameType || !args.startAt || !args.rounds || !args.pairingMode || !Array.isArray(args.uma)) throw new Error("大会名、種別、開始時刻、回戦数、組み合わせ、ウマが必要です");
      response = await postTournament(jsonRequest("http://internal/api/tournaments", "POST", actor, { name: args.name, gameType: args.gameType, startAt: args.startAt, rounds: args.rounds, pairingMode: args.pairingMode, uma: args.uma, password: args.password ?? "", notice: args.notice ?? "" }));
    } else {
      if (!args.tournamentId || !Number.isInteger(args.round)) throw new Error("大会IDと回戦が必要です");
      const stateResponse = await readState(actor, args.tournamentId); const states = await stateResponse.json() as Array<{ round: number; version: number }>;
      const current = states.find((item) => item.round === args.round); if (!current) throw new Error("回戦状態が見つかりません");
      const body: Record<string, unknown> = { tournamentId: args.tournamentId, round: args.round, expectedVersion: args.expectedVersion ?? current.version, action: operation === "set_room_id" ? "room" : operation === "set_scores" ? "scores" : operation === "approve_result" ? "approve" : operation === "schedule_round" ? "schedule" : operation === "cancel_schedule" ? "cancel_schedule" : operation };
      if (args.tableIndex !== undefined) body.tableIndex = args.tableIndex; if (args.roomId !== undefined) body.roomId = args.roomId; if (args.scores !== undefined) body.scores = args.scores; if (args.deadline !== undefined) body.deadline = args.deadline;
      response = await putState(jsonRequest("http://internal/api/tournaments/state", "PUT", actor, body));
    }
    const result = await readJson(response); if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "JanMatch操作に失敗しました");
    await finishOperation(auditId, "completed", JSON.stringify({ operation })); return { ok: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作に失敗しました"; await finishOperation(auditId, "failed", "", message); throw new Error(message);
  }
}

export async function executePendingJanmatchOperation(actor: JanmatchActor, token: string) {
  const row = await env.DB.prepare("SELECT id, actor_discord_user_id as actorDiscordUserId, guild_id as guildId, channel_id as channelId, operation_type as operationType, arguments_json as argumentsJson, actor_roles_json as actorRolesJson, confirmation_expires_at as expiresAt, status FROM operation_requests WHERE confirmation_token = ?").bind(token).first<{ id: string; actorDiscordUserId: string; guildId: string; channelId: string; operationType: string; argumentsJson: string; actorRolesJson: string; expiresAt: string; status: string }>();
  if (!row || row.status !== "pending_confirmation" || row.actorDiscordUserId !== actor.discordUserId || (row.expiresAt && Date.parse(row.expiresAt) < Date.now())) throw new Error("確認操作が無効、または期限切れです");
  const operatorOnly = new Set(["create_tournament", "start", "confirm", "schedule_round", "cancel_schedule"]);
  const operatorRoleId = getConfig().operatorRoleId;
  if (operatorOnly.has(row.operationType) && (!operatorRoleId || !actor.roles?.includes(operatorRoleId))) throw new Error("確認時点で運営ロールが必要です");
  const args = JSON.parse(row.argumentsJson || "{}") as OperationArgs;
  const claim = await env.DB.prepare("UPDATE operation_requests SET status = 'executing' WHERE id = ? AND actor_discord_user_id = ? AND status = 'pending_confirmation' AND (confirmation_expires_at IS NULL OR julianday(confirmation_expires_at) > julianday('now'))").bind(row.id, actor.discordUserId).run();
  if (!claim.meta.changes) throw new Error("この確認操作はすでに実行中、または完了しています");
  const result = await executeJanmatchOperation({ ...actor, guildId: row.guildId, channelId: row.channelId, roles: actor.roles }, row.operationType, { ...args, confirmed: true }, row.id);
  return result;
}
