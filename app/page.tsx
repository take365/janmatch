"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Phase = "before" | "active" | "ended";
type Tournament = { id: string; name: string; gameType?: string; date: string; rounds: number; status: string; color: string; pairingMode?: string; phase?: Phase; owner?: string };
const initialTournaments: Tournament[] = [
  { id: "janmatch-01", name: "第1回 JanMatch交流戦", gameType: "雀魂-じゃんたま-", date: "2026年10月12日（月）20:00開始", rounds: 4, status: "開催前", color: "green", pairingMode: "最終戦だけ順位卓", phase: "before", owner: "きたろう" },
];
const phaseLabels: { value: Phase; label: string }[] = [{ value: "before", label: "開催前" }, { value: "active", label: "開催中" }, { value: "ended", label: "終了" }];
function normalizePhase(t: Tournament): Phase { if (t.phase) return t.phase; if (t.status === "終了") return "ended"; if (t.status === "開催中") return "active"; return "before"; }

export default function TournamentListPage() {
  const [tournaments, setTournaments] = useState(initialTournaments);
  const [selected, setSelected] = useState<Phase[]>(["before", "active"]);
  const [currentNickname, setCurrentNickname] = useState("");
  useEffect(() => { const saved = window.localStorage.getItem("janmatch:tournaments"); if (saved) { const cleaned = JSON.parse(saved).filter((item: Tournament) => !/テスト|サンプル/.test(item.name)); window.localStorage.setItem("janmatch:tournaments", JSON.stringify(cleaned)); setTournaments([...cleaned, ...initialTournaments]); } setCurrentNickname(window.localStorage.getItem("janmatch:nickname") ?? ""); }, []);
  const visible = useMemo(() => tournaments.filter((t) => selected.includes(normalizePhase(t))), [selected, tournaments]);
  const toggle = (phase: Phase) => setSelected((current) => current.includes(phase) ? current.filter((value) => value !== phase) : [...current, phase]);
  return <main className="jm-user-shell">
    <header className="jm-user-header"><div><p className="janmatch-kicker">JANMATCH</p><h1>大会一覧</h1><p>参加する大会を選ぶか、新しい大会を作成します。</p></div><nav><Link className="jm-create-link" href="/tournaments/new">＋ 大会を作成</Link><Link href="/profile">利用者登録</Link><Link href="/admin">大会管理（暫定）</Link></nav></header>
    <section className="jm-profile-hint"><strong>はじめての方へ</strong><span>まず利用者登録でニックネームを設定してください。</span><Link href="/profile">登録・変更する →</Link></section>
    <div className="jm-list-toolbar"><p className="janmatch-kicker">TOURNAMENTS</p><div className="jm-phase-filters">{phaseLabels.map((phase) => <button key={phase.value} className={selected.includes(phase.value) ? "selected" : ""} onClick={() => toggle(phase.value)}>{phase.label}</button>)}</div></div>
    <section className="jm-tournament-grid">{visible.map((t) => <article className="jm-tournament-card" key={t.id}><div className={`jm-tournament-accent ${t.color}`} /><div className="jm-card-body"><Link href={`/tournaments/${t.id}`} className="jm-card-main"><div className="jm-card-meta"><span className="jm-status">{t.status}</span><span>{t.date}</span></div><h2>{t.name}</h2><div className="jm-card-stats"><span>{t.gameType ?? "雀魂-じゃんたま-"}</span><span>全{t.rounds}回戦</span></div><p className="jm-card-pairing">組み合わせ：{t.pairingMode ?? "未設定"}</p><p className="jm-card-owner">主催者：{t.owner ?? "未設定"}</p><span className="jm-card-link">大会詳細・参加登録 →</span></Link>{normalizePhase(t) === "before" && currentNickname && currentNickname === t.owner && <Link className="jm-card-edit" href={`/tournaments/${t.id}/edit`}>主催者編集 →</Link>}</div></article>)}{visible.length === 0 && <div className="jm-list-empty">選択した状態の大会はありません。</div>}</section>
  </main>;
}
