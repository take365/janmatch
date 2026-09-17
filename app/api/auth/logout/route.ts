import { env } from "cloudflare:workers";
import { AUTH_COOKIE, cookieHeader, cookieValue, getConfig, hash } from "../../../lib/discord-auth";

export async function POST(request: Request) { const token = cookieValue(request, AUTH_COOKIE); if (token && env.DB) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await hash(token)).run(); const response = Response.json({ ok: true }); response.headers.append("Set-Cookie", cookieHeader(AUTH_COOKIE, "", 0, Boolean(getConfig().appOrigin?.startsWith("https://")))); return response; }
