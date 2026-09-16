"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
export default function ManageTournamentPage() { const { id } = useParams<{ id: string }>(); return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><p className="janmatch-kicker">ORGANIZER CONSOLE</p><h1>大会管理</h1><section className="jm-lock-card"><h2>受付・卓組み管理</h2><p>主催者用の受付開始、参加者確定、卓決定画面です。</p><Link className="jm-action-admin" href={`/tournaments/${id}?mode=manage`}>受付開始画面を開く</Link></section></main>; }
