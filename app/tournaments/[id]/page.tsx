"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Table = { label: string; members: string[]; representative: string; roomId?: string; scores?: number[]; approvals?: string[]; resultStatus?: string };
type Round = { round: number; status: string; deadline?: number; tables: Table[]; version: number };
type Tournament = { id: string; name: string; date?: string; startAt?: string; rounds: number; notice?: string; owner?: string; gameType?: string; pairingMode?: string; uma?: string | number[]; phase?: "before" | "active" | "ended"; passwordRequired: boolean; accessGranted: boolean; isOrganizer: boolean };
type ScoreRow = { nickname: string; rank: number; rawScore: number; adjustedScore: number };

const phaseLabels = { before: "開催前", active: "開催中", ended: "終了" };

function parseUma(value: Tournament["uma"]): number[] {
  if (Array.isArray(value)) return value.map(Number);
  try { const parsed = JSON.parse(value ?? "[20,10,0,0]"); return Array.isArray(parsed) ? parsed.map(Number) : [20, 10, 0, 0]; } catch { return [20, 10, 0, 0]; }
}

function getScoreRows(table: Table, uma: number[]): ScoreRow[] {
  if (!table.scores || table.scores.length !== table.members.length) return [];
  const sorted = table.scores.map((score, index) => ({ score: Number(score), index })).sort((a, b) => b.score - a.score || a.index - b.index);
  const allocations = new Array(table.members.length).fill(0) as number[];
  const ranks = new Array(table.members.length).fill(0) as number[];
  let start = 0;
  while (start < sorted.length) {
    let end = start + 1;
    while (end < sorted.length && sorted[end].score === sorted[start].score) end += 1;
    const averageUma = uma.slice(start, end).reduce((sum, value) => sum + value, 0) / (end - start);
    for (let index = start; index < end; index += 1) { ranks[sorted[index].index] = start + 1; allocations[sorted[index].index] = averageUma; }
    start = end;
  }
  return table.members.map((nickname, index) => ({ nickname, rank: ranks[index], rawScore: Number(table.scores?.[index] ?? 0), adjustedScore: Number(table.scores?.[index] ?? 0) / 1000 + allocations[index] })).sort((a, b) => a.rank - b.rank || a.nickname.localeCompare(b.nickname, "ja"));
}

function displayScore(value: number) { return value.toFixed(1); }

export default function TournamentPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [organizer, setOrganizer] = useState(false);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [entries, setEntries] = useState<boolean[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<{ key: string; kind: "room" | "scores" } | null>(null);
  const manage = searchParams.get("mode") === "manage" && organizer;

  const load = async () => {
    const profileResponse = await fetch("/api/profile");
    const profile = profileResponse.ok ? await profileResponse.json() as { nickname?: string } : { nickname: "" };
    const nick = profile.nickname ?? "";
    setNickname(nick);
    const response = await fetch(`/api/tournaments?id=${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error("大会データを取得できませんでした。");
    const data = await response.json() as Tournament & { roundStates?: Round[] };
    if (!data) throw new Error("大会が見つかりません。");
    setTournament({ ...data, date: data.date ?? data.startAt }); setOrganizer(Boolean(data.isOrganizer)); setUnlocked(Boolean(data.accessGranted)); setRounds(data.roundStates ?? []);
    const entriesResponse = nick ? await fetch(`/api/tournaments/entries?tournamentId=${encodeURIComponent(id)}`) : null;
    const rows = entriesResponse?.ok ? await entriesResponse.json() as Array<{ round: number; joined: boolean | number }> : [];
    setEntries(Array.from({ length: data.rounds }, (_, index) => Boolean(rows.find((row) => row.round === index + 1)?.joined)));
  };

  useEffect(() => { load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "大会データを取得できませんでした。")); }, [id]);

  const mutateRound = async (roundIndex: number, action: string, extra: Record<string, unknown> = {}) => {
    const round = rounds[roundIndex]; if (!round) return false;
    const response = await fetch("/api/tournaments/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ tournamentId: id, round: round.round, expectedVersion: round.version, action, ...extra }) });
    const payload = await response.json() as Round & { error?: string; current?: Round };
    if (response.status === 409 && payload.current) setRounds((current) => current.map((item) => item.round === payload.current?.round ? payload.current : item));
    if (!response.ok) { setMessage(payload.error ?? "大会状態の保存に失敗しました"); return false; }
    setRounds((current) => current.map((item) => item.round === payload.round ? payload : item)); return true;
  };

  const toggleEntry = async (index: number) => {
    if (rounds[index]?.status !== "受付中") return;
    const joined = !entries[index]; setEntries((current) => current.map((value, itemIndex) => itemIndex === index ? joined : value));
    const response = await fetch("/api/tournaments/entries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tournamentId: id, round: index + 1, joined }) });
    if (!response.ok) { setEntries((current) => current.map((value, itemIndex) => itemIndex === index ? !joined : value)); const payload = await response.json().catch(() => null) as { error?: string } | null; setMessage(payload?.error ?? "参加登録の保存に失敗しました"); }
  };

  const setRoom = (roundIndex: number, tableIndex: number, value: string) => { void mutateRound(roundIndex, "room", { tableIndex, roomId: value }).then((saved) => { if (saved) setEditing(null); }); };
  const setScores = (roundIndex: number, tableIndex: number, value: string) => {
    const scores = value.split(",").map((item) => Number(item.trim()));
    if (scores.length !== 4 || scores.some((item) => !Number.isFinite(item) || !Number.isInteger(item)) || scores.reduce((sum, item) => sum + item, 0) !== 100000) { setMessage("4人の生点は整数で、合計100000になるよう入力してください"); return; }
    void mutateRound(roundIndex, "scores", { tableIndex, scores }).then((saved) => { if (saved) { setEditing(null); setMessage("結果を登録しました。全員の承認待ちです"); } });
  };
  const approve = (roundIndex: number, tableIndex: number) => { void mutateRound(roundIndex, "approve", { tableIndex }); };
  const unlock = async () => {
    const response = await fetch("/api/tournaments/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tournamentId: id, password }) });
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) { setMessage(payload?.error ?? "大会を開けませんでした"); return; }
    setUnlocked(true); setMessage("大会内容を確認できます（次回から入力不要）"); await load();
  };

  const joinedCount = useMemo(() => entries.filter(Boolean).length, [entries]);
  if (error) return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><p className="jm-error">{error}</p></main>;
  if (!tournament) return <main className="jm-user-shell jm-narrow"><p>大会データを読み込んでいます。</p></main>;
  const phase = tournament.phase ?? "before"; const uma = parseUma(tournament.uma);
  return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><div className="jm-detail-title"><div><span className="jm-status">{phaseLabels[phase]}</span><h1>{tournament.name}</h1><p>{tournament.date}</p><p className="jm-card-owner">主催者：{tournament.owner ?? "未設定"}</p></div><div className="jm-detail-actions"><Link href={`/tournaments/${id}/results`} className="jm-outline">参加者一覧</Link><Link href="/profile" className="jm-outline">ニックネーム変更</Link></div></div>{!unlocked ? <section className="jm-lock-card"><h2>参加用パスワードを入力</h2><div className="jm-password-row"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /><button className="jm-primary" onClick={unlock}>大会を開く</button></div>{message && <p className="jm-error">{message}</p>}</section> : <><section className="jm-detail-card"><p className="janmatch-kicker">ABOUT</p><h2>大会概要</h2><p>{tournament.gameType} / 全{tournament.rounds}回戦 / 組み合わせ：{tournament.pairingMode}</p><p>{tournament.notice}</p></section><section className="jm-detail-card"><div className="jm-round-head"><h2>{manage ? "受付・卓組み管理" : "回戦受付"}</h2>{!manage && <span>{joinedCount}/{tournament.rounds}回戦 参加</span>}</div>{rounds.map((round, roundIndex) => { const visibleTables = manage ? round.tables : round.tables.filter((table) => table.members.includes(nickname)); return <div className="jm-round-block" key={round.round}><h3>{round.round}回戦 <small>{round.status}</small></h3>{manage && round.status === "受付前" && <button className="jm-primary" onClick={() => void mutateRound(roundIndex, "start")}>受付開始（60秒）</button>}{manage && round.status === "受付中" && <button className="jm-primary" onClick={() => void mutateRound(roundIndex, "confirm")}>参加者を確定して卓決め</button>}{!manage && round.status === "受付中" && <button className={entries[roundIndex] ? "joined" : ""} onClick={() => void toggleEntry(roundIndex)}>{entries[roundIndex] ? "参加登録を取り消す" : "参加登録"}</button>}{!manage && round.status === "確定" && <p className="jm-round-closed">卓確定・参加締切</p>}{!manage && round.status === "受付中" && entries[roundIndex] && <p className="jm-round-closed">参加登録済み・卓決め待ち</p>}{!manage && round.status === "確定" && !entries[roundIndex] && visibleTables.length === 0 && <p className="jm-round-empty">この回戦には参加していません</p>}{visibleTables.map((table, tableIndex) => { const tableKey = `${round.round}:${table.label}`; const editable = round.status === "確定" && table.resultStatus !== "結果確定" && table.representative === nickname; const scoreRows = getScoreRows(table, uma); const originalIndex = round.tables.indexOf(table); return <div className="jm-table-row" key={table.label}><b>{table.label}</b><span>{table.members.join("・")}</span><small>代表者：{table.representative}{table.roomId ? ` / ルームID：${table.roomId}` : ""}</small>{scoreRows.length > 0 && <div className="jm-own-score-table"><div className="jm-own-score-head"><span>順位</span><span>参加者</span><span>順位点込み</span><span>生点</span></div>{scoreRows.map((score) => <div key={score.nickname}><span>{score.rank}</span><span>{score.nickname}</span><span>{displayScore(score.adjustedScore)}</span><span>{displayScore(score.rawScore / 1000)}</span></div>)}</div>}{table.scores && table.resultStatus === "結果登録済み（承認待ち）" && <small className="jm-pending-result">結果承認待ち</small>}{table.resultStatus === "結果確定" && <small>結果確定（編集不可）</small>}{editable && <div><button onClick={() => setEditing({ key: tableKey, kind: "room" })}>ルームID登録</button><button onClick={() => setEditing({ key: tableKey, kind: "scores" })}>結果登録</button>{editing?.key === tableKey && editing.kind === "room" && <input autoFocus placeholder="ルームID" defaultValue={table.roomId ?? ""} onBlur={(event) => setRoom(roundIndex, originalIndex, event.target.value)} />}{editing?.key === tableKey && editing.kind === "scores" && <input autoFocus placeholder="生点4人分（例: 25000,25000,25000,25000）" defaultValue={table.scores?.join(",") ?? ""} onBlur={(event) => setScores(roundIndex, originalIndex, event.target.value)} />}</div>}{table.scores && table.members.includes(nickname) && table.resultStatus === "結果登録済み（承認待ち）" && <button onClick={() => approve(roundIndex, originalIndex)}>結果承認</button>}</div>; })}</div>; })}{message && <p className="jm-success">{message}</p>}</section></>}</main>;
}
