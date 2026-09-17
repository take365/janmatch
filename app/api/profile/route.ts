import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "../../lib/discord-auth";

export async function GET(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Discordでログインしてください" }, { status: 401 });
  return Response.json({ nickname: user.nickname, gameName: user.gameName });
}

export async function POST(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const body = await request.json() as { nickname?: unknown; gameName?: unknown };
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const gameName = typeof body.gameName === "string" ? body.gameName.trim() : "";
  if (!nickname || nickname.length > 30 || gameName.length > 30) return Response.json({ error: "ニックネームを正しく入力してください" }, { status: 400 });
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: "Discordでログインしてください" }, { status: 401 });
  await env.DB.prepare("UPDATE users SET nickname = ?, game_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(nickname, gameName, user.id).run();
  return Response.json({ ok: true, nickname, gameName });
}
