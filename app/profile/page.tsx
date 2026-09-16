"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Profile = { nickname: string; gameName: string };

export default function ProfilePage() {
  const [nickname, setNickname] = useState("");
  const [gameName, setGameName] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const profile = JSON.parse(window.localStorage.getItem("janmatch:profile") ?? "null") as Profile | null;
    setNickname(profile?.nickname ?? window.localStorage.getItem("janmatch:nickname") ?? "");
    setGameName(profile?.gameName ?? window.localStorage.getItem("janmatch:game-name") ?? "");
  }, []);
  const save = () => {
    const profile = { nickname: nickname.trim(), gameName: gameName.trim() };
    if (!profile.nickname) return;
    window.localStorage.setItem("janmatch:profile", JSON.stringify(profile));
    window.localStorage.setItem("janmatch:nickname", profile.nickname);
    window.localStorage.setItem("janmatch:game-name", profile.gameName);
    setSaved(true); window.setTimeout(() => setSaved(false), 1800);
  };
  return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><p className="janmatch-kicker">YOUR PROFILE</p><h1>利用者登録</h1><p className="jm-muted">大会で表示する名前と、ゲーム内で使っている名前を登録します。</p><section className="jm-form-card"><label>大会でのニックネーム<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="大会で表示する名前" maxLength={30} /></label><label>ゲーム内の名称（雀魂）<input value={gameName} onChange={(event) => setGameName(event.target.value)} placeholder="雀魂で表示される名前" maxLength={30} /></label><p className="jm-mapping-note">結果画面の点数を読み取るときに、ゲーム内の名称とこの利用者情報を照合します。表記ゆれがある場合は、表示どおりに登録してください。</p><button className="jm-primary" onClick={save}>{saved ? "保存しました" : "保存する"}</button><p className="jm-form-note">現在はこのブラウザに保存するローカル版です。将来はDiscord認証とアカウント保存に移行します。</p></section></main>;
}
