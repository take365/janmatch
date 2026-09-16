"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [nickname, setNickname] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => setNickname(window.localStorage.getItem("janmatch:nickname") ?? ""), []);
  const save = () => { const value = nickname.trim(); if (!value) return; window.localStorage.setItem("janmatch:nickname", value); setNickname(value); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><p className="janmatch-kicker">YOUR PROFILE</p><h1>利用者登録</h1><p className="jm-muted">大会で表示するニックネームを登録します。現在はこのブラウザに保存するローカル版です。</p><section className="jm-form-card"><label>ニックネーム<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="大会で表示する名前" maxLength={30} /></label><button className="jm-primary" onClick={save}>{saved ? "保存しました" : "保存する"}</button><p className="jm-form-note">将来はDiscord認証にも対応予定です。Discordの表示名を初期値にし、大会ごとに別名を設定できる形にします。</p></section></main>;
}
