"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const tournament = { name: "第1回 JanMatch交流戦", date: "2026年10月12日（月）20:00開始", password: "JMP2026", rounds: 4, notice: "東南戦／25000点持ち。ウマは1位+20、2位+10、3位0、4位0。結果画像を提出してください。" };

export default function TournamentPage() {
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [rounds, setRounds] = useState<boolean[]>([false, false, false, false]);
  const [message, setMessage] = useState("");
  useEffect(() => setNickname(window.localStorage.getItem("janmatch:nickname") ?? ""), []);
  const joinedCount = useMemo(() => rounds.filter(Boolean).length, [rounds]);
  const unlock = () => password === tournament.password ? (setUnlocked(true), setMessage("大会内容を確認できます")) : setMessage("パスワードが違います");
  const toggleRound = (index: number) => { if (!nickname) { setMessage("先に利用者登録でニックネームを設定してください"); return; } setRounds((current) => current.map((value, i) => i === index ? !value : value)); setMessage(`${index + 1}回戦の参加状態を更新しました`); };
  return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><div className="jm-detail-title"><div><span className="jm-status">募集中</span><h1>{tournament.name}</h1><p>{tournament.date}</p></div><Link href="/profile" className="jm-outline">ニックネーム変更</Link></div>{!unlocked ? <section className="jm-lock-card"><p className="janmatch-kicker">TOURNAMENT ACCESS</p><h2>参加用パスワードを入力</h2><p>大会主催者から共有されたパスワードを入力してください。</p><div className="jm-password-row"><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="大会パスワード" onKeyDown={(event) => event.key === "Enter" && unlock()} /><button className="jm-primary" onClick={unlock}>大会を開く</button></div>{message && <p className="jm-error">{message}</p>}</section> : <section className="jm-detail-grid"><article className="jm-detail-card"><p className="janmatch-kicker">ABOUT</p><h2>大会概要</h2><dl><dt>開催日時</dt><dd>{tournament.date}</dd><dt>回戦数</dt><dd>全{tournament.rounds}回戦</dd><dt>ウマ</dt><dd>1位 +20　2位 +10　3位 0　4位 0</dd></dl><div className="jm-notice-box"><strong>ルール・お知らせ</strong><p>{tournament.notice}</p></div></article><article className="jm-detail-card"><div className="jm-round-head"><div><p className="janmatch-kicker">YOUR ENTRY</p><h2>{nickname || "ニックネーム未登録"}</h2></div><span>{joinedCount}/{tournament.rounds}回戦 参加</span></div><p className="jm-muted">参加する回戦のボタンを押してください。主催者が締め切るまで変更できます。</p><div className="jm-round-list">{rounds.map((joined, index) => <button key={index} className={joined ? "joined" : ""} onClick={() => toggleRound(index)}><span><b>{index + 1}回戦</b><small>{joined ? "参加登録済み" : "参加予定を登録"}</small></span><strong>{joined ? "参加" : "参加する"}</strong></button>)}</div>{message && <p className="jm-success">{message}</p>}</article></section>}</main>;
}
