"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ProfilePage() {
  const [nickname, setNickname] = useState("");
  const [gameName, setGameName] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([fetch("/api/profile"), fetch("/api/auth/me")]).then(async ([profileResponse, authResponse]) => { const profile = profileResponse.ok ? await profileResponse.json() as { nickname?: string; gameName?: string } : {}; const auth = authResponse.ok ? await authResponse.json() as { user?: { discordNickname?: string; discordUsername?: string } } : {}; setNickname(profile.nickname || auth.user?.discordNickname || auth.user?.discordUsername || ""); setGameName(profile.gameName ?? ""); }).catch(() => setError("利用者情報を取得できませんでした。")); }, []);
  const save = async () => {
    const response = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nickname: nickname.trim(), gameName: gameName.trim() }) });
    if (!response.ok) { const payload = await response.json().catch(() => null) as { error?: string } | null; setError(payload?.error ?? "保存に失敗しました"); return; }
    setSaved(true); setError(""); window.setTimeout(() => setSaved(false), 1800);
  };
  return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><p className="janmatch-kicker">YOUR PROFILE</p><h1>利用者登録</h1><p className="jm-muted">大会で表示する名前と、ゲーム内で使っている名前を登録します。</p><section className="jm-form-card"><label>大会でのニックネーム<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="大会で表示する名前" maxLength={30} /></label><label>ゲーム内の名称（雀魂）<input value={gameName} onChange={(event) => setGameName(event.target.value)} placeholder="雀魂で表示される名前" maxLength={30} /></label><p className="jm-mapping-note">結果画面の点数を読み取るときに、ゲーム内の名称とこの利用者情報を照合します。表記ゆれがある場合は、表示どおりに登録してください。</p>{error && <p className="jm-error">{error}</p>}<button className="jm-primary" onClick={() => void save()}>{saved ? "保存しました" : "保存する"}</button><p className="jm-form-note">利用者情報はD1に保存され、このブラウザのHttpOnlyセッションCookieで呼び出します。</p></section></main>;
}
