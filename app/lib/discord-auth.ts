import { env } from "cloudflare:workers";

export const AUTH_COOKIE = "janmatch_auth";
export const OAUTH_STATE_COOKIE = "janmatch_oauth_state";
type Config = { clientId?: string; clientSecret?: string; guildId?: string; appOrigin?: string };

function config(): Config {
  const values = env as unknown as Record<string, unknown>;
  return { clientId: typeof values.DISCORD_CLIENT_ID === "string" ? values.DISCORD_CLIENT_ID : undefined, clientSecret: typeof values.DISCORD_CLIENT_SECRET === "string" ? values.DISCORD_CLIENT_SECRET : undefined, guildId: typeof values.DISCORD_GUILD_ID === "string" ? values.DISCORD_GUILD_ID : undefined, appOrigin: typeof values.APP_ORIGIN === "string" ? values.APP_ORIGIN : undefined };
}

export function redirectUri(request: Request) { return `${config().appOrigin || new URL(request.url).origin}/api/auth/discord/callback`; }
export function discordConfigured() { const value = config(); return Boolean(value.clientId && value.clientSecret && value.guildId); }
export function getConfig() { return config(); }

export async function hash(value: string) { const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
export function cookieValue(request: Request, name: string) { const match = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return match ? decodeURIComponent(match[1]) : null; }
export function cookieHeader(name: string, value: string, maxAge: number, secure: boolean) { return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`; }

export async function getAuthenticatedUser(request: Request) {
  if (!env.DB) return null;
  const token = cookieValue(request, AUTH_COOKIE); if (!token) return null;
  const tokenHash = await hash(token);
  return env.DB.prepare("SELECT u.id, u.discord_user_id as discordUserId, u.discord_username as discordUsername, u.discord_nickname as discordNickname, u.nickname, u.game_name as gameName FROM auth_sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP").bind(tokenHash).first<{ id: string; discordUserId: string; discordUsername: string; discordNickname: string; nickname: string; gameName: string }>();
}

export async function requireConfig() { const value = config(); if (!value.clientId || !value.clientSecret || !value.guildId) throw new Error("Discord OAuth2の環境変数が未設定です"); return value as { clientId: string; clientSecret: string; guildId: string; appOrigin?: string }; }
