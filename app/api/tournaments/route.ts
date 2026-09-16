import { env } from "cloudflare:workers";
const getDb = () => env.DB;

export async function GET(request: Request) {
  const db = getDb(); if (!db) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const id = new URL(request.url).searchParams.get("id");
  const query = id ? "SELECT id, owner, name, game_type as gameType, start_at as startAt, password, rounds, pairing_mode as pairingMode, uma, notice, phase, created_at as createdAt FROM tournaments WHERE id = ?" : "SELECT id, owner, name, game_type as gameType, start_at as startAt, rounds, pairing_mode as pairingMode, uma, notice, phase, created_at as createdAt FROM tournaments ORDER BY start_at ASC";
  const result = id ? await db.prepare(query).bind(id).all() : await db.prepare(query).all();
  return Response.json(id ? result.results[0] ?? null : result.results);
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const required = ["id", "owner", "name", "gameType", "startAt", "rounds", "pairingMode", "uma"];
  if (required.some((key) => body[key] === undefined || body[key] === "")) return Response.json({ error: "必須項目が不足しています" }, { status: 400 });
  const db = getDb(); if (!db) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  await db.prepare("INSERT INTO tournaments (id, owner, name, game_type, start_at, password, rounds, pairing_mode, uma, notice, phase) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'before')").bind(body.id, body.owner, body.name, body.gameType, body.startAt, body.password, body.rounds, body.pairingMode, JSON.stringify(body.uma), body.notice ?? "").run();
  return Response.json({ ok: true, id: body.id });
}

export async function PUT(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const db = getDb(); if (!db) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const result = await db.prepare("UPDATE tournaments SET name = ?, game_type = ?, password = ?, rounds = ?, pairing_mode = ?, notice = ? WHERE id = ? AND owner = ? AND phase = 'before'").bind(body.name, body.gameType, body.password, body.rounds, body.pairingMode, body.notice ?? "", body.id, body.owner).run();
  return Response.json({ ok: result.meta.changes > 0 });
}
