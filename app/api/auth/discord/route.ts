import { env } from "cloudflare:workers";
import { cookieHeader, getConfig, hash, OAUTH_STATE_COOKIE, redirectUri, discordConfigured } from "../../../lib/discord-auth";

export async function GET(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  if (!discordConfigured()) return Response.json({ error: "Discord OAuth2の環境変数が未設定です" }, { status: 503 });
  const state = crypto.randomUUID(); const stateHash = await hash(state); const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO oauth_states (state_hash, expires_at) VALUES (?, ?)").bind(stateHash, expires).run();
  const value = getConfig(); const params = new URLSearchParams({ client_id: value.clientId ?? "", response_type: "code", redirect_uri: redirectUri(request), scope: "identify guilds.members.read", state });
  const response = Response.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`, 302); response.headers.append("Set-Cookie", cookieHeader(OAUTH_STATE_COOKIE, state, 600, redirectUri(request).startsWith("https://"))); return response;
}
