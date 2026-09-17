import { env } from "cloudflare:workers";
import { getProfile, hasTournamentAccess } from "../../lib/session";

type TournamentBody = { id?: unknown; name?: unknown; gameType?: unknown; startAt?: unknown; password?: unknown; rounds?: unknown; pairingMode?: unknown; uma?: unknown; notice?: unknown };
type RoundState = { tables: Array<{ label: string; members: string[]; representative: string; roomId?: string; scores?: number[]; approvals?: string[]; resultStatus?: string }>; deadline?: number };

const getDb = () => env.DB;
const asText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const asRounds = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 20 ? value : 0;
const defaultRounds = (count: number) => Array.from({ length: count }, (_, index) => ({ round: index + 1, status: "受付前", tables: [], version: 0 }));
const parseState = (value: unknown): RoundState => {
  try {
    const parsed = JSON.parse(String(value ?? "{\"tables\":[]}")) as Partial<RoundState>;
    return { tables: Array.isArray(parsed.tables) ? parsed.tables : [], ...(typeof parsed.deadline === "number" ? { deadline: parsed.deadline } : {}) };
  } catch { return { tables: [] }; }
};

export async function GET(request: Request) {
  const db = getDb(); if (!db) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const id = new URL(request.url).searchParams.get("id");
  const query = id ? "SELECT id, owner, owner_user_id as ownerUserId, name, game_type as gameType, start_at as startAt, password, rounds, pairing_mode as pairingMode, uma, notice, phase, created_at as createdAt FROM tournaments WHERE id = ?" : "SELECT id, owner, owner_user_id as ownerUserId, name, game_type as gameType, start_at as startAt, rounds, pairing_mode as pairingMode, uma, notice, phase, created_at as createdAt FROM tournaments ORDER BY start_at ASC";
  const result = id ? await db.prepare(query).bind(id).all() : await db.prepare(query).all();
  if (!id) {
    const profile = await getProfile(request);
    return Response.json((result.results as Array<Record<string, unknown>>).map(({ ownerUserId, ...tournament }) => ({ ...tournament, isOrganizer: Boolean(profile && ownerUserId && profile.sessionId === ownerUserId) })));
  }
  const tournament = result.results[0] as Record<string, unknown> | undefined;
  if (!tournament) return Response.json(null, { status: 404 });
  const profile = await getProfile(request);
  const isOrganizer = Boolean(profile && tournament.ownerUserId && profile.sessionId === tournament.ownerUserId);
  const accessGranted = !tournament.password || isOrganizer || hasTournamentAccess(request, id);
  const states = accessGranted ? await db.prepare("SELECT round, status, state_json as stateJson, version FROM tournament_rounds WHERE tournament_id = ? ORDER BY round").bind(id).all() : { results: [] };
  const rounds = accessGranted ? (states.results as Array<Record<string, unknown>>).map((row) => ({ round: row.round, status: row.status, ...parseState(row.stateJson), version: row.version })) : [];
  const { password: _password, ...publicTournament } = tournament;
  return Response.json({ ...publicTournament, passwordRequired: Boolean(tournament.password), accessGranted, isOrganizer, roundStates: accessGranted ? (rounds.length ? rounds : defaultRounds(Number(tournament.rounds))) : [] });
}

export async function POST(request: Request) {
  const body = await request.json() as TournamentBody;
  const profile = await getProfile(request);
  if (!profile || !profile.nickname) return Response.json({ error: "Discordでログインし、プロフィールを設定してください" }, { status: 401 });
  const name = asText(body.name); const gameType = asText(body.gameType); const startAt = asText(body.startAt); const pairingMode = asText(body.pairingMode); const rounds = asRounds(body.rounds);
  if (!name || !gameType || !startAt || !pairingMode || !rounds || !Array.isArray(body.uma)) return Response.json({ error: "必須項目が不足しています" }, { status: 400 });
  const db = getDb(); if (!db) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const id = asText(body.id) || `tournament-${crypto.randomUUID()}`;
  const password = asText(body.password); const notice = asText(body.notice);
  const statements = [db.prepare("INSERT INTO tournaments (id, owner, owner_user_id, name, game_type, start_at, password, rounds, pairing_mode, uma, notice, phase) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'before')").bind(id, profile.nickname, profile.sessionId, name, gameType, startAt, password, rounds, pairingMode, JSON.stringify(body.uma), notice), ...defaultRounds(rounds).map((round) => db.prepare("INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (?, ?, ?, ?, ?)").bind(id, round.round, round.status, JSON.stringify({ tables: [] }), 0))];
  await db.batch(statements);
  return Response.json({ ok: true, id }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json() as TournamentBody;
  const db = getDb(); if (!db) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const profile = await getProfile(request); const id = asText(body.id); const name = asText(body.name); const gameType = asText(body.gameType); const pairingMode = asText(body.pairingMode); const rounds = asRounds(body.rounds);
  if (!profile || !id) return Response.json({ error: "利用者登録または大会IDが必要です" }, { status: 401 });
  if (!name || !gameType || !pairingMode || !rounds) return Response.json({ error: "必須項目が不足しています" }, { status: 400 });
  const password = typeof body.password === "string" ? body.password.trim() : null;
  const result = await db.prepare("UPDATE tournaments SET name = ?, game_type = ?, password = COALESCE(?, password), rounds = ?, pairing_mode = ?, notice = ? WHERE id = ? AND owner_user_id = ? AND phase = 'before'").bind(name, gameType, password, rounds, pairingMode, asText(body.notice), id, profile.sessionId).run();
  return Response.json({ ok: result.meta.changes > 0 });
}
