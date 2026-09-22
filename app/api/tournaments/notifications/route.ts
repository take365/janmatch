import { env } from "cloudflare:workers";
import { getTournamentNotice, notifyTournament } from "../../../lib/discord-webhook";
import { runDiscordResourceLifecycle } from "../../../lib/discord-resources";

type Table = { resultStatus?: string };
type RoundState = { tables: Table[]; deadline?: number };

function cronSecret() {
  const value = env as unknown as Record<string, unknown>;
  return typeof value.DISCORD_CRON_SECRET === "string" ? value.DISCORD_CRON_SECRET : "";
}

function parseState(value: unknown): RoundState {
  try {
    const parsed = JSON.parse(String(value ?? "{}")) as Partial<RoundState>;
    return { tables: Array.isArray(parsed.tables) ? parsed.tables : [], ...(typeof parsed.deadline === "number" ? { deadline: parsed.deadline } : {}) };
  } catch { return { tables: [] }; }
}

function localCheck(request: Request) {
  const hostname = new URL(request.url).hostname;
  return (hostname === "localhost" || hostname === "127.0.0.1") && request.headers.get("x-janmatch-local-check") === "1";
}

export async function GET(request: Request) {
  const provided = request.headers.get("x-janmatch-cron") ?? "";
  if ((!cronSecret() || provided !== cronSecret()) && !localCheck(request)) return Response.json({ error: "通知確認の認証に失敗しました" }, { status: 401 });
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const resources = await runDiscordResourceLifecycle();
  const now = Date.now();
  const rounds = await env.DB.prepare("SELECT tournament_id as tournamentId, round, state_json as stateJson FROM tournament_rounds WHERE status = '受付中'").all<{ tournamentId: string; round: number; stateJson: string }>();
  let checked = 0; let attempted = 0;
  for (const row of rounds.results) {
    const state = parseState(row.stateJson);
    if (!state.deadline || state.deadline <= now) continue;
    checked += 1;
    const remaining = state.deadline - now;
    const notice = await getTournamentNotice(row.tournamentId);
    if (!notice) continue;
    if (remaining <= 30 * 60 * 1000 && remaining > 5 * 60 * 1000) { attempted += 1; await notifyTournament(request, notice, row.round, "deadline-30", "30分後に受付を終了し、卓を確定します。参加登録を確認してください。"); }
    if (remaining <= 5 * 60 * 1000) { attempted += 1; await notifyTournament(request, notice, row.round, "deadline-5", "5分後に受付を終了し、卓を確定します。未登録の場合は参加できません。"); }
  }
  return Response.json({ ok: true, checked, attempted, resources });
}
