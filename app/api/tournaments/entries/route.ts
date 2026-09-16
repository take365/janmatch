import { env } from "cloudflare:workers";
import { getProfile, hasTournamentAccess } from "../../../lib/session";

export async function GET(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const tournamentId = new URL(request.url).searchParams.get("tournamentId");
  const profile = await getProfile(request);
  if (!tournamentId) return Response.json({ error: "大会IDが必要です" }, { status: 400 });
  if (!profile) return Response.json([]);
  const tournament = await env.DB.prepare("SELECT password, owner FROM tournaments WHERE id = ?").bind(tournamentId).first<{ password: string; owner: string }>();
  if (!tournament) return Response.json({ error: "大会が見つかりません" }, { status: 404 });
  const isOrganizer = profile.nickname === tournament.owner;
  if (tournament.password && !isOrganizer && !hasTournamentAccess(request, tournamentId)) return Response.json({ error: "大会のパスワードが必要です" }, { status: 403 });
  const result = await env.DB.prepare("SELECT round, joined FROM tournament_entries WHERE tournament_id = ? AND nickname = ? ORDER BY round").bind(tournamentId, profile.nickname).all();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const body = await request.json() as { tournamentId?: unknown; round?: unknown; joined?: unknown };
  const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId : "";
  const round = typeof body.round === "number" ? body.round : 0;
  const profile = await getProfile(request);
  if (!profile) return Response.json({ error: "先に利用者登録をしてください" }, { status: 401 });
  const tournament = await env.DB.prepare("SELECT rounds, phase, password, owner FROM tournaments WHERE id = ?").bind(tournamentId).first<{ rounds: number; phase: string; password: string; owner: string }>();
  if (!tournament || !Number.isInteger(round) || round < 1 || round > tournament.rounds) return Response.json({ error: "大会または回戦が見つかりません" }, { status: 400 });
  const isOrganizer = profile.nickname === tournament.owner;
  if (tournament.password && !isOrganizer && !hasTournamentAccess(request, tournamentId)) return Response.json({ error: "大会のパスワードが必要です" }, { status: 403 });
  const id = `${tournamentId}:${profile.nickname}:${round}`;
  await env.DB.prepare("INSERT INTO tournament_entries (id, tournament_id, nickname, round, joined) VALUES (?, ?, ?, ?, ?) ON CONFLICT(tournament_id, nickname, round) DO UPDATE SET joined = excluded.joined").bind(id, tournamentId, profile.nickname, round, body.joined === true ? 1 : 0).run();
  return Response.json({ ok: true, round, joined: body.joined === true });
}
