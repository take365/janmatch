import { getAuthenticatedUser } from "../../../lib/discord-auth";

export async function GET(request: Request) { const user = await getAuthenticatedUser(request); return user ? Response.json({ authenticated: true, user }) : Response.json({ authenticated: false }, { status: 401 }); }
