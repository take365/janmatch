import { env } from "cloudflare:workers";
import { getAuthenticatedUser } from "./discord-auth";

export function getAccessCookieName(tournamentId: string): string {
  return `janmatch_access_${tournamentId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function hasTournamentAccess(request: Request, tournamentId: string): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").some((item) => item.trim() === `${getAccessCookieName(tournamentId)}=1`);
}

export async function getProfile(request: Request): Promise<{ sessionId: string; nickname: string; gameName: string } | null> {
  if (!env.DB) return null;
  const user = await getAuthenticatedUser(request);
  return user ? { sessionId: user.id, nickname: user.nickname, gameName: user.gameName } : null;
}
