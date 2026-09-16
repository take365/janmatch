"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Tournament = { id: string; name: string; date: string; rounds: number; status: string; color: string };
const initialTournaments: Tournament[] = [
  { id: "janmatch-01", name: "第1回 JanMatch交流戦", date: "2026年10月12日（月）20:00開始", rounds: 4, status: "募集中", color: "green" },
  { id: "janmatch-test", name: "JanMatchテスト大会", date: "2026年10月18日（日）13:00開始", rounds: 3, status: "参加受付中", color: "blue" },
];

export default function TournamentListPage() {
  const [tournaments, setTournaments] = useState(initialTournaments);
  useEffect(() => { const saved = window.localStorage.getItem("janmatch:tournaments"); if (saved) setTournaments([...JSON.parse(saved), ...initialTournaments]); }, []);
  return <main className="jm-user-shell"><header className="jm-user-header"><div><p className="janmatch-kicker">JANMATCH</p><h1>大会一覧</h1><p>参加する大会を選ぶか、新しい大会を作成します。</p></div><nav><Link className="jm-create-link" href="/tournaments/new">＋ 大会を作成</Link><Link href="/profile">利用者登録</Link><Link href="/admin">大会管理（暫定）</Link></nav></header><section className="jm-profile-hint"><strong>はじめての方へ</strong><span>まず利用者登録でニックネームを設定してください。</span><Link href="/profile">登録・変更する →</Link></section><section className="jm-tournament-grid">{tournaments.map((tournament) => <Link href={`/tournaments/${tournament.id}`} className="jm-tournament-card" key={tournament.id}><div className={`jm-tournament-accent ${tournament.color}`} /><div className="jm-card-body"><div className="jm-card-meta"><span className="jm-status">{tournament.status}</span><span>{tournament.date}</span></div><h2>{tournament.name}</h2><div className="jm-card-stats"><span>全{tournament.rounds}回戦</span></div><span className="jm-card-link">大会詳細・参加登録 →</span></div></Link>)}</section></main>;
}
