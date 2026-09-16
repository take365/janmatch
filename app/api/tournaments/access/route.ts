import { env } from "cloudflare:workers";
import { getAccessCookieName } from "../../../lib/session";

export async function POST(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const body = await request.json() as { tournamentId?: unknown; password?: unknown };
  const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId : "";
  const password = typeof body.password === "string" ? body.password : "";
  const tournament = await env.DB.prepare("SELECT password FROM tournaments WHERE id = ?").bind(tournamentId).first<{ password: string }>();
  if (!tournament) return Response.json({ error: "大会が見つかりません" }, { status: 404 });
  if (tournament.password && tournament.password !== password) return Response.json({ error: "パスワードが違います" }, { status: 403 });
  const response = Response.json({ ok: true });
  response.headers.append("Set-Cookie", `${getAccessCookieName(tournamentId)}=1; Max-Age=10368000; Path=/; HttpOnly; SameSite=Lax`);
  return response;
}
