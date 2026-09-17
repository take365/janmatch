import { env } from "cloudflare:workers";
import { getProfile, hasTournamentAccess } from "../../../lib/session";

export async function GET(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const tournamentId = new URL(request.url).searchParams.get("tournamentId");
  const profile = await getProfile(request);
  if (!tournamentId) return Response.json({ error: "大会IDが必要です" }, { status: 400 });
  if (!profile) return Response.json([]);
  const tournament = await env.DB.prepare("SELECT password, owner, owner_user_id as ownerUserId FROM tournaments WHERE id = ?").bind(tournamentId).first<{ password: string; owner: string; ownerUserId?: string }>();
  if (!tournament) return Response.json({ error: "大会が見つかりません" }, { status: 404 });
  const isOrganizer = profile.sessionId === tournament.ownerUserId;
  if (tournament.password && !isOrganizer && !hasTournamentAccess(request, tournamentId)) return Response.json({ error: "大会のパスワードが必要です" }, { status: 403 });
  const result = await env.DB.prepare("SELECT round, joined, game_name as gameName FROM tournament_entries WHERE tournament_id = ? AND user_id = ? ORDER BY round").bind(tournamentId, profile.sessionId).all();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const body = await request.json() as { tournamentId?: unknown; round?: unknown; joined?: unknown };
  const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId : "";
  const round = typeof body.round === "number" ? body.round : 0;
  const profile = await getProfile(request);
  if (!profile) return Response.json({ error: "先に利用者登録をしてください" }, { status: 401 });
  const tournament = await env.DB.prepare("SELECT rounds, phase, password, owner, owner_user_id as ownerUserId FROM tournaments WHERE id = ?").bind(tournamentId).first<{ rounds: number; phase: string; password: string; owner: string; ownerUserId?: string }>();
  if (!tournament || !Number.isInteger(round) || round < 1 || round > tournament.rounds) return Response.json({ error: "大会または回戦が見つかりません" }, { status: 400 });
  const roundState = await env.DB.prepare("SELECT status FROM tournament_rounds WHERE tournament_id = ? AND round = ?").bind(tournamentId, round).first<{ status: string }>();
  if (!roundState || roundState.status !== "受付中") return Response.json({ error: roundState?.status === "確定" ? "この回戦は参加受付を終了しています" : "この回戦はまだ受付を開始していません" }, { status: 409 });
  const isOrganizer = profile.sessionId === tournament.ownerUserId;
  if (tournament.password && !isOrganizer && !hasTournamentAccess(request, tournamentId)) return Response.json({ error: "大会のパスワードが必要です" }, { status: 403 });
  const id = `${tournamentId}:${profile.sessionId}:${round}`;
  await env.DB.prepare("INSERT INTO tournament_entries (id, tournament_id, user_id, nickname, game_name, round, joined) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tournament_id, user_id, round) DO UPDATE SET joined = excluded.joined, nickname = excluded.nickname, game_name = CASE WHEN excluded.joined = 1 THEN excluded.game_name ELSE tournament_entries.game_name END").bind(id, tournamentId, profile.sessionId, profile.nickname, profile.gameName, round, body.joined === true ? 1 : 0).run();
  return Response.json({ ok: true, round, joined: body.joined === true });
}
