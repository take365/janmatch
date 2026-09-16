import { env } from "cloudflare:workers";
import { getProfile, hasTournamentAccess } from "../../../lib/session";

type Table = { label: string; members: string[]; scores?: number[]; resultStatus?: string };
type RoundState = { tables: Table[] };

function parseUma(value: unknown): number[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) && parsed.length === 4 && parsed.every((item) => Number.isFinite(Number(item))) ? parsed.map(Number) : [20, 10, 0, 0];
  } catch { return [20, 10, 0, 0]; }
}

function parseState(value: unknown): RoundState {
  try {
    const parsed = JSON.parse(String(value ?? "{\"tables\":[]}")) as Partial<RoundState>;
    return { tables: Array.isArray(parsed.tables) ? parsed.tables as Table[] : [] };
  } catch { return { tables: [] }; }
}

function rankUma(scores: number[], uma: number[]) {
  const sorted = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score || a.index - b.index);
  const allocations = new Array(scores.length).fill(0) as number[];
  const ranks = new Array(scores.length).fill(0) as number[];
  let index = 0;
  while (index < sorted.length) {
    let end = index + 1;
    while (end < sorted.length && sorted[end].score === sorted[index].score) end += 1;
    const rank = index + 1;
    const averageUma = uma.slice(index, end).reduce((sum, value) => sum + value, 0) / (end - index);
    for (let item = index; item < end; item += 1) { ranks[sorted[item].index] = rank; allocations[sorted[item].index] = averageUma; }
    index = end;
  }
  return { ranks, allocations };
}

export async function GET(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const tournamentId = new URL(request.url).searchParams.get("tournamentId");
  if (!tournamentId) return Response.json({ error: "大会IDが必要です" }, { status: 400 });
  const tournament = await env.DB.prepare("SELECT id, name, password, owner, rounds, uma FROM tournaments WHERE id = ?").bind(tournamentId).first<{ id: string; name: string; password: string; owner: string; rounds: number; uma: string }>();
  if (!tournament) return Response.json({ error: "大会が見つかりません" }, { status: 404 });
  const profile = await getProfile(request);
  const isOrganizer = profile?.nickname === tournament.owner;
  if (tournament.password && !isOrganizer && !hasTournamentAccess(request, tournamentId)) return Response.json({ error: "大会のパスワードが必要です" }, { status: 403 });

  const [entries, states] = await Promise.all([
    env.DB.prepare("SELECT nickname, game_name as gameName, round FROM tournament_entries WHERE tournament_id = ? AND joined = 1 ORDER BY round ASC").bind(tournamentId).all<{ nickname: string; gameName: string; round: number }>(),
    env.DB.prepare("SELECT round, status, state_json as stateJson FROM tournament_rounds WHERE tournament_id = ? ORDER BY round").bind(tournamentId).all<{ round: number; status: string; stateJson: string }>(),
  ]);
  const gameNames = new Map<string, string>();
  for (const entry of entries.results) if (!gameNames.get(entry.nickname) && entry.gameName) gameNames.set(entry.nickname, entry.gameName);
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
      if (table.resultStatus !== "結果確定" || !table.scores || table.scores.length !== table.members.length || table.scores.length !== 4 || table.scores.reduce((sum, value) => sum + Number(value), 0) !== 100000) return result;
      const scores = table.scores.map(Number);
      const { ranks, allocations } = rankUma(scores, uma);
      const memberIndex = table.members.indexOf(nickname);
      const rawScore = scores[memberIndex];
      const score = rawScore / 1000 + allocations[memberIndex];
      result.rank = ranks[memberIndex]; result.rawScore = rawScore; result.score = score; result.confirmed = true;
      totalRaw += rawScore; totalWithUma += score;
      return result;
    });
    return { nickname, gameName: gameNames.get(nickname) ?? "", rounds: roundResults, totalRaw, totalWithUma };
  }).sort((a, b) => b.totalWithUma - a.totalWithUma || a.nickname.localeCompare(b.nickname, "ja"));
  let previousTotal: number | undefined;
  let previousRank = 0;
  const rankedParticipants = participants.map((participant, index) => {
    const rank = previousTotal !== undefined && participant.totalWithUma === previousTotal ? previousRank : index + 1;
    previousTotal = participant.totalWithUma; previousRank = rank;
    return { ...participant, rank };
  });
  return Response.json({ tournament: { id: tournament.id, name: tournament.name, rounds: tournament.rounds, uma }, rounds: rounds.map(({ state: _state, ...round }) => round), participants: rankedParticipants });
}
