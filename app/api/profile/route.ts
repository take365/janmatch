import { env } from "cloudflare:workers";
import { getOrCreateSessionId, setSessionCookie } from "../../lib/session";

export async function GET(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const { sessionId, existingSessionId } = getOrCreateSessionId(request);
  const profile = await env.DB.prepare("SELECT nickname, game_name as gameName FROM profiles WHERE session_id = ?").bind(sessionId).first<{ nickname: string; gameName: string }>();
  return setSessionCookie(Response.json(profile ?? { nickname: "", gameName: "" }), sessionId, existingSessionId);
}

export async function POST(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const body = await request.json() as { nickname?: unknown; gameName?: unknown };
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const gameName = typeof body.gameName === "string" ? body.gameName.trim() : "";
  if (!nickname || nickname.length > 30 || gameName.length > 30) return Response.json({ error: "ニックネームを正しく入力してください" }, { status: 400 });
  const { sessionId, existingSessionId } = getOrCreateSessionId(request);
  await env.DB.prepare("INSERT INTO profiles (session_id, nickname, game_name) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET nickname = excluded.nickname, game_name = excluded.game_name, updated_at = CURRENT_TIMESTAMP").bind(sessionId, nickname, gameName).run();
  return setSessionCookie(Response.json({ ok: true, nickname, gameName }), sessionId, existingSessionId);
}
