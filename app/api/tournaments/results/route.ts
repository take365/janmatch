import { env } from "cloudflare:workers";
import { getProfile, hasTournamentAccess } from "../../../lib/session";

type Table = { label: string; members: string[]; scores?: number[]; resultStatus?: string };
type RoundState = { tables: Table[] };

function parseUma(value: unknown): number[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) && parsed.length === 4 ? parsed.map(Number) : [20, 10, 0, 0];
  } catch { return [20, 10, 0, 0]; }
}

function parseState(value: unknown): RoundState {
  try {
    const parsed = JSON.parse(String(value ?? "{\"tables\":[]}")) as Partial<RoundState>;
    return { tables: Array.isArray(parsed.tables) ? parsed.tables as Table[] : [] };
  } catch { return { tables: [] }; }
}

export async function GET(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const tournamentId = new URL(request.url).searchParams.get("tournamentId");
  if (!tournamentId) return Response.json({ error: "大会IDが必要です" }, { status: 400 });
  const tournament = await env.DB.prepare("SELECT id, name, password, owner, rounds, uma FROM tournaments WHERE id = ?").bind(tournamentId).first<{ id: string; name: string; password: string; owner: string; rounds: number; uma: string }>();
  if (!tournament) return Response.json({ error: "大会が見つかりません" }, { status: 404 });
  const profile = await getProfile(request);
  if (!profile) return Response.json({ error: "先に利用者登録をしてください" }, { status: 401 });
  const isOrganizer = profile.nickname === tournament.owner;
  if (tournament.password && !isOrganizer && !hasTournamentAccess(request, tournamentId)) return Response.json({ error: "大会のパスワードが必要です" }, { status: 403 });

  const [entries, states, profiles] = await Promise.all([
    env.DB.prepare("SELECT DISTINCT nickname FROM tournament_entries WHERE tournament_id = ? AND joined = 1 ORDER BY nickname").bind(tournamentId).all<{ nickname: string }>(),
    env.DB.prepare("SELECT round, status, state_json as stateJson FROM tournament_rounds WHERE tournament_id = ? ORDER BY round").bind(tournamentId).all<{ round: number; status: string; stateJson: string }>(),
    env.DB.prepare("SELECT nickname, game_name as gameName FROM profiles").all<{ nickname: string; gameName: string }>(),
  ]);
  const gameNames = new Map(profiles.results.map((item) => [item.nickname, item.gameName]));
  const participantNames = new Set(entries.results.map((item) => item.nickname));
  const rounds = states.results.map((row) => ({ round: row.round, status: row.status, state: parseState(row.stateJson) }));
  for (const round of rounds) for (const table of round.state.tables) for (const member of table.members) participantNames.add(member);
  const uma = parseUma(tournament.uma);
  const participants = [...participantNames].map((nickname) => {
    let totalRaw = 0;
    let totalWithUma = 0;
    const roundResults = rounds.map((round) => {
      const table = round.state.tables.find((item) => item.members.includes(nickname));
      const result: { table?: string; rank?: number; rawScore?: number; score?: number; confirmed: boolean } = { confirmed: false };
      if (!table) return result;
      result.table = table.label;
      if (table.resultStatus !== "結果確定" || !table.scores || table.scores.length !== table.members.length) return result;
      const memberScores = table.members.map((member, index) => ({ member, score: Number(table.scores?.[index] ?? 0) }));
      memberScores.sort((a, b) => b.score - a.score);
      const rank = memberScores.findIndex((item) => item.member === nickname) + 1;
      const rawScore = Number(table.scores[table.members.indexOf(nickname)]);
      const score = rawScore + (uma[rank - 1] ?? 0);
      result.rank = rank; result.rawScore = rawScore; result.score = score; result.confirmed = true;
      totalRaw += rawScore; totalWithUma += score;
      return result;
    });
    return { nickname, gameName: gameNames.get(nickname) ?? "", rounds: roundResults, totalRaw, totalWithUma };
  }).sort((a, b) => b.totalWithUma - a.totalWithUma || a.nickname.localeCompare(b.nickname, "ja"));
  return Response.json({ tournament: { id: tournament.id, name: tournament.name, rounds: tournament.rounds, uma }, rounds: rounds.map(({ state: _state, ...round }) => round), participants });
}
