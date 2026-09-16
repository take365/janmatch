"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type RoundResult = { table?: string; rank?: number; rawScore?: number; score?: number; confirmed: boolean };
type Participant = { nickname: string; gameName: string; rank: number; rounds: RoundResult[]; totalRaw: number; totalWithUma: number };
type Results = { tournament: { id: string; name: string; rounds: number; uma: number[] }; rounds: Array<{ round: number; status: string }>; participants: Participant[] };

function displayRaw(value?: number) { return value === undefined ? "" : (value / 1000).toFixed(1); }
function displayAdjusted(value?: number) { return value === undefined ? "" : value.toFixed(1); }

export default function TournamentResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Results | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/tournaments/results?tournamentId=${encodeURIComponent(id)}`).then(async (response) => {
      const payload = await response.json() as Results & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "成績一覧を取得できませんでした");
      setData(payload);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "成績一覧を取得できませんでした"));
  }, [id]);
  if (error) return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href={`/tournaments/${id}`}>← 大会詳細</Link><p className="jm-error">{error}</p></main>;
  if (!data) return <main className="jm-user-shell jm-narrow"><p>成績一覧を読み込んでいます。</p></main>;
  return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href={`/tournaments/${id}`}>← 大会詳細</Link><div className="jm-results-title"><div><p className="janmatch-kicker">STANDINGS</p><h1>{data.tournament.name}</h1><p className="jm-muted">参加者一覧（成績一覧）</p></div><span className="jm-uma-summary">ウマ：{data.tournament.uma.join(" / ")}</span></div><section className="jm-results-card"><div className="jm-results-scroll"><table className="jm-results-table"><thead><tr><th>順位</th><th>参加者（ゲーム内名）</th>{data.rounds.map((round) => <th key={round.round}>{round.round}回戦</th>)}<th>合計</th></tr></thead><tbody>{data.participants.map((participant) => <tr key={participant.nickname}><td>{participant.rank}</td><th>{participant.nickname}<small>{participant.gameName}</small></th>{participant.rounds.map((round, roundIndex) => <td key={roundIndex}>{round.table && <span className="jm-result-table-name">{round.table}</span>}{round.confirmed && <><strong>{displayAdjusted(round.score)}</strong><small>（{displayRaw(round.rawScore)}）</small></>}</td>)}<td><strong>{displayAdjusted(participant.totalWithUma)}</strong><small>（{displayRaw(participant.totalRaw)}）</small></td></tr>)}</tbody></table></div><p className="jm-results-note">上段：順位点込み（千点単位）／下段：生点。未確定の結果は表示・集計されません。</p></section></main>;
}
