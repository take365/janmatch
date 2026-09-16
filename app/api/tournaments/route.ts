import { env } from "cloudflare:workers";
const getDb = () => env.DB;

export async function GET() {
  const db = getDb(); if (!db) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const result = await db.prepare("SELECT id, owner, name, game_type as gameType, start_at as startAt, rounds, pairing_mode as pairingMode, uma, notice, phase, created_at as createdAt FROM tournaments ORDER BY start_at ASC").all();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const required = ["id", "owner", "name", "gameType", "startAt", "password", "rounds", "pairingMode", "uma"];
  if (required.some((key) => body[key] === undefined || body[key] === "")) return Response.json({ error: "必須項目が不足しています" }, { status: 400 });
  const db = getDb(); if (!db) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  await db.prepare("INSERT INTO tournaments (id, owner, name, game_type, start_at, password, rounds, pairing_mode, uma, notice, phase) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'before')").bind(body.id, body.owner, body.name, body.gameType, body.startAt, body.password, body.rounds, body.pairingMode, JSON.stringify(body.uma), body.notice ?? "").run();
  return Response.json({ ok: true, id: body.id });
}
