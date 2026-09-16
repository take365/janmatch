import { env } from "cloudflare:workers";

export const SESSION_COOKIE = "janmatch_session";

export function getSessionId(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getAccessCookieName(tournamentId: string): string {
  return `janmatch_access_${tournamentId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function hasTournamentAccess(request: Request, tournamentId: string): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").some((item) => item.trim() === `${getAccessCookieName(tournamentId)}=1`);
}

export async function getProfile(request: Request): Promise<{ sessionId: string; nickname: string; gameName: string } | null> {
  const sessionId = getSessionId(request);
  if (!sessionId || !env.DB) return null;
  const row = await env.DB.prepare("SELECT session_id as sessionId, nickname, game_name as gameName FROM profiles WHERE session_id = ?").bind(sessionId).first<{ sessionId: string; nickname: string; gameName: string }>();
  return row ?? null;
}

export function setSessionCookie(response: Response, sessionId: string, existingSessionId: string | null): Response {
  if (!existingSessionId) {
    response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax`);
  }
  return response;
}

export function getOrCreateSessionId(request: Request): { sessionId: string; existingSessionId: string | null } {
  const existingSessionId = getSessionId(request);
  return { sessionId: existingSessionId ?? crypto.randomUUID(), existingSessionId };
}
