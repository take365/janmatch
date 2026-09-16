"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const modes = ["最終戦だけ順位卓", "重複回避ランダム", "2回戦目以降すべて順位卓"];
const umaLabels = ["1位", "2位", "3位", "4位"];

export default function NewTournamentPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [gameType, setGameType] = useState("雀魂-じゃんたま-");
  const [startAt, setStartAt] = useState("");
  const [password, setPassword] = useState("");
  const [noPassword, setNoPassword] = useState(false);
  const [rounds, setRounds] = useState("4");
  const [pairingMode, setPairingMode] = useState(modes[0]);
  const [uma, setUma] = useState(["20", "10", "0", "0"]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !startAt || (!noPassword && !password.trim())) {
      setError("大会名・開始予定日時を入力してください");
      return;
    }
    const body = { name: name.trim(), gameType, startAt, password: noPassword ? "" : password, rounds: Number(rounds), pairingMode, uma: uma.map(Number), notice };
    const response = await fetch("/api/tournaments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      setError(payload?.error ?? "D1への保存に失敗しました");
      return;
    }
    router.push("/");
  };

  return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><p className="janmatch-kicker">CREATE TOURNAMENT</p><h1>大会を作成</h1><form className="jm-form-card jm-create-form" onSubmit={submit}><label>大会名<input value={name} onChange={event => setName(event.target.value)} /></label><label>ゲームの種類<input value={gameType} onChange={event => setGameType(event.target.value)} /></label><label>開始予定日時<input type="datetime-local" value={startAt} onChange={event => setStartAt(event.target.value)} /></label><label>参加パスワード<input type="text" value={password} disabled={noPassword} onChange={event => setPassword(event.target.value)} /></label><label className="jm-check-label"><input type="checkbox" checked={noPassword} onChange={event => setNoPassword(event.target.checked)} /> パスワードなしで参加可能にする</label><label>全回戦数<input type="number" value={rounds} min={1} max={20} onChange={event => setRounds(event.target.value)} /></label><label>組み合わせ方式<select value={pairingMode} onChange={event => setPairingMode(event.target.value)}>{modes.map(mode => <option key={mode}>{mode}</option>)}</select></label><fieldset><legend>ウマ（順位点）</legend><div className="jm-uma-grid">{umaLabels.map((label, index) => <label key={label}>{label}<input type="number" value={uma[index]} onChange={event => setUma(current => current.map((value, i) => i === index ? event.target.value : value))} /></label>)}</div><p className="jm-form-note">初期値は 1位20・2位10・3位0・4位0 です。マイナスの数値も入力できます。</p></fieldset><label>ルール・お知らせ<textarea value={notice} onChange={event => setNotice(event.target.value)} /></label>{error && <p className="jm-error">{error}</p>}<div className="jm-form-actions"><Link className="jm-cancel" href="/">キャンセル</Link><button className="jm-primary">大会を作成する</button></div></form></main>;
}
