import { env } from "cloudflare:workers";
import { getProfile, hasTournamentAccess } from "../../../lib/session";

type Table = { label: string; members: string[]; representative: string; roomId?: string; scores?: number[]; approvals?: string[]; resultStatus?: string };
type RoundState = { tables: Table[]; deadline?: number };
type StateBody = { tournamentId?: unknown; round?: unknown; expectedVersion?: unknown; action?: unknown; tableIndex?: unknown; roomId?: unknown; scores?: unknown };

function parseState(value: unknown): RoundState {
  try {
    const state = JSON.parse(String(value ?? "{\"tables\":[]}")) as Partial<RoundState>;
    return { tables: Array.isArray(state.tables) ? state.tables as Table[] : [], ...(typeof state.deadline === "number" ? { deadline: state.deadline } : {}) };
  } catch { return { tables: [] }; }
}

function buildTables(names: string[]): Table[] {
  const unique = [...new Set(names)];
  const tables: Table[] = [];
  for (let index = 0; index < unique.length; index += 4) {
    const members = unique.slice(index, index + 4);
    tables.push({ label: `${String.fromCharCode(65 + tables.length)}卓`, members, representative: members[0] });
  }
  return tables;
}

async function findRound(tournamentId: string, round: number) {
  return env.DB.prepare("SELECT status, state_json as stateJson, version FROM tournament_rounds WHERE tournament_id = ? AND round = ?").bind(tournamentId, round).first<{ status: string; stateJson: string; version: number }>();
}

export async function GET(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const tournamentId = new URL(request.url).searchParams.get("tournamentId");
  if (!tournamentId) return Response.json({ error: "大会IDが必要です" }, { status: 400 });
  const tournament = await env.DB.prepare("SELECT password FROM tournaments WHERE id = ?").bind(tournamentId).first<{ password: string }>();
  if (!tournament) return Response.json({ error: "大会が見つかりません" }, { status: 404 });
  if (tournament.password && !hasTournamentAccess(request, tournamentId)) return Response.json({ error: "大会のパスワードが必要です" }, { status: 403 });
  const result = await env.DB.prepare("SELECT round, status, state_json as stateJson, version FROM tournament_rounds WHERE tournament_id = ? ORDER BY round").bind(tournamentId).all();
  return Response.json((result.results as Array<Record<string, unknown>>).map((row) => ({ round: row.round, status: row.status, ...parseState(row.stateJson), version: row.version })));
}

export async function PUT(request: Request) {
  if (!env.DB) return Response.json({ error: "D1 binding is unavailable" }, { status: 503 });
  const body = await request.json() as StateBody;
  const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId : "";
  const round = typeof body.round === "number" ? body.round : 0;
  const expectedVersion = typeof body.expectedVersion === "number" ? body.expectedVersion : -1;
  const action = typeof body.action === "string" ? body.action : "";
  const profile = await getProfile(request);
  if (!profile) return Response.json({ error: "先に利用者登録をしてください" }, { status: 401 });
  const tournament = await env.DB.prepare("SELECT rounds, owner, password FROM tournaments WHERE id = ?").bind(tournamentId).first<{ rounds: number; owner: string; password: string }>();
  if (!tournament || !Number.isInteger(round) || round < 1 || round > tournament.rounds) return Response.json({ error: "大会または回戦が見つかりません" }, { status: 400 });
  const current = await findRound(tournamentId, round);
  if (!current) return Response.json({ error: "回戦状態が見つかりません。マイグレーションを適用してください" }, { status: 409 });
  if (current.version !== expectedVersion) return Response.json({ error: "他の操作で状態が更新されています", current: { round, status: current.status, ...parseState(current.stateJson), version: current.version } }, { status: 409 });

  const isOrganizer = profile.nickname === tournament.owner;
  if (!isOrganizer && tournament.password && !hasTournamentAccess(request, tournamentId)) return Response.json({ error: "大会のパスワードが必要です" }, { status: 403 });
  const state = parseState(current.stateJson);
  let status = current.status;
  let nextState = state;
  if (action === "start") {
    if (!isOrganizer || current.status !== "受付前") return Response.json({ error: "主催者だけが受付を開始できます" }, { status: 403 });
    if (round > 1) {
      const previous = await findRound(tournamentId, round - 1);
      if (previous?.status !== "確定") return Response.json({ error: "前の回戦が完了してから開始できます" }, { status: 409 });
    }
    status = "受付中"; nextState = { ...state, deadline: Date.now() + 60000 };
  } else if (action === "confirm") {
    if (!isOrganizer || current.status !== "受付中") return Response.json({ error: "受付中の回戦だけ確定できます" }, { status: 403 });
    const entries = await env.DB.prepare("SELECT DISTINCT nickname FROM tournament_entries WHERE tournament_id = ? AND round = ? AND joined = 1 ORDER BY nickname").bind(tournamentId, round).all<{ nickname: string }>();
    status = "確定"; nextState = { tables: buildTables(entries.results.map((entry: { nickname: string }) => entry.nickname)) };
  } else {
    const tableIndex = typeof body.tableIndex === "number" ? body.tableIndex : -1;
    const table = state.tables[tableIndex];
    if (!table) return Response.json({ error: "卓が見つかりません" }, { status: 400 });
    if (action === "room") {
      if (table.representative !== profile.nickname && !isOrganizer) return Response.json({ error: "卓の代表者だけがルームIDを変更できます" }, { status: 403 });
      if (current.status !== "確定" || table.resultStatus === "結果確定") return Response.json({ error: "確定済みの卓だけ編集できます" }, { status: 403 });
      const roomId = typeof body.roomId === "string" ? body.roomId.trim() : "";
      nextState = { ...state, tables: state.tables.map((item, index) => index === tableIndex ? { ...item, roomId: roomId || undefined } : item) };
    } else if (action === "scores") {
      if (table.representative !== profile.nickname && !isOrganizer) return Response.json({ error: "卓の代表者だけが結果を登録できます" }, { status: 403 });
      if (current.status !== "確定" || table.resultStatus === "結果確定") return Response.json({ error: "承認待ちまたは未登録の結果だけ編集できます" }, { status: 403 });
      const scores = Array.isArray(body.scores) ? body.scores.map((value) => typeof value === "number" ? value : Number(value)) : [];
      if (scores.length !== 4 || scores.some((value) => !Number.isFinite(value) || !Number.isInteger(value)) || scores.reduce((sum, value) => sum + value, 0) !== 100000) return Response.json({ error: "4人の生点は整数で、合計100000になるよう入力してください" }, { status: 400 });
      nextState = { ...state, tables: state.tables.map((item, index) => index === tableIndex ? { ...item, scores, approvals: [], resultStatus: "結果登録済み（承認待ち）" } : item) };
    } else if (action === "approve") {
      if (current.status !== "確定" || table.resultStatus !== "結果登録済み（承認待ち）" || !table.members.includes(profile.nickname) || !table.scores) return Response.json({ error: "承認待ちの卓の参加者だけが結果を承認できます" }, { status: 403 });
      const approvals = [...new Set([...(table.approvals ?? []), profile.nickname])];
      nextState = { ...state, tables: state.tables.map((item, index) => index === tableIndex ? { ...item, approvals, resultStatus: approvals.length >= item.members.length ? "結果確定" : "結果登録済み（承認待ち）" } : item) };
    } else return Response.json({ error: "未対応の操作です" }, { status: 400 });
  }

  const updated = await env.DB.prepare("UPDATE tournament_rounds SET status = ?, state_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE tournament_id = ? AND round = ? AND version = ?").bind(status, JSON.stringify(nextState), tournamentId, round, expectedVersion).run();
  if (!updated.meta.changes) return Response.json({ error: "他の操作で状態が更新されています" }, { status: 409 });
  return Response.json({ ok: true, round, status, ...nextState, version: expectedVersion + 1 });
}
