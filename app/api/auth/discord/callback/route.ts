import { env } from "cloudflare:workers";
import { cookieHeader, getConfig, hash, OAUTH_STATE_COOKIE, redirectUri } from "../../../../lib/discord-auth";

type DiscordUser = { id: string; username?: string; global_name?: string };
function failure(request: Request, message: string) { return Response.redirect(`${new URL("/login", request.url).toString()}?error=${encodeURIComponent(message)}`, 302); }

export async function GET(request: Request) {
  if (!env.DB) return failure(request, "認証データベースを利用できません");
  const params = new URL(request.url).searchParams; const code = params.get("code"); const state = params.get("state"); const savedState = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];
  if (!code || !state || !savedState || state !== decodeURIComponent(savedState)) return failure(request, "OAuth認証の検証に失敗しました");
  const stateHash = await hash(state); const stateRow = await env.DB.prepare("SELECT state_hash as stateHash FROM oauth_states WHERE state_hash = ? AND expires_at > CURRENT_TIMESTAMP").bind(stateHash).first();
  if (!stateRow) return failure(request, "OAuth認証の有効期限が切れています");
  await env.DB.prepare("DELETE FROM oauth_states WHERE state_hash = ?").bind(stateHash).run();
  try {
    const value = getConfig(); if (!value.clientId || !value.clientSecret || !value.guildId) throw new Error("Discord OAuth2の環境変数が未設定です");
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: value.clientId, client_secret: value.clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri(request) }) });
    if (!tokenResponse.ok) throw new Error("Discordトークン交換に失敗しました");
    const token = await tokenResponse.json() as { access_token?: string }; if (!token.access_token) throw new Error("Discordアクセストークンを取得できませんでした");
    const userResponse = await fetch("https://discord.com/api/users/@me", { headers: { authorization: `Bearer ${token.access_token}` } }); if (!userResponse.ok) throw new Error("Discordユーザー情報を取得できませんでした"); const user = await userResponse.json() as DiscordUser;
    const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${value.guildId}/member`, { headers: { authorization: `Bearer ${token.access_token}` } }); if (memberResponse.status === 404) throw new Error("対象のオンライン麻雀大会サーバーへ参加してから再度ログインしてください"); if (!memberResponse.ok) throw new Error("Discordサーバー所属を確認できませんでした");
    const userId = crypto.randomUUID(); await env.DB.prepare("INSERT INTO users (id, discord_user_id, discord_username) VALUES (?, ?, ?) ON CONFLICT(discord_user_id) DO UPDATE SET discord_username = excluded.discord_username, updated_at = CURRENT_TIMESTAMP").bind(userId, user.id, user.global_name || user.username || user.id).run();
    const savedUser = await env.DB.prepare("SELECT id FROM users WHERE discord_user_id = ?").bind(user.id).first<{ id: string }>(); if (!savedUser) throw new Error("ユーザー保存に失敗しました");
    const rawSession = crypto.randomUUID(); await env.DB.prepare("INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), savedUser.id, await hash(rawSession), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run();
    const response = Response.redirect(new URL("/profile", request.url).toString(), 302); const secure = redirectUri(request).startsWith("https://"); response.headers.append("Set-Cookie", cookieHeader("janmatch_auth", rawSession, 30 * 24 * 60 * 60, secure)); response.headers.append("Set-Cookie", cookieHeader(OAUTH_STATE_COOKIE, "", 0, secure)); return response;
  } catch (error) { return failure(request, error instanceof Error ? error.message : "Discordログインに失敗しました"); }
}
