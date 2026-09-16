"use client";

import { useMemo, useState } from "react";

type Player = { name: string; score: number; active: boolean };

const seed: Player[] = [
  { name: "きたろう", score: 0, active: true },
  { name: "てらさん", score: 0, active: true },
  { name: "麻雀太郎", score: 0, active: true },
  { name: "Rita", score: 0, active: true },
  { name: "まこさん", score: 0, active: false },
];

export default function Home() {
  const [players, setPlayers] = useState(seed);
  const [round, setRound] = useState(1);
  const [started, setStarted] = useState(false);
  const [newName, setNewName] = useState("");
  const [notice, setNotice] = useState("大会を作成して参加者を受け付けます");
  const active = players.filter((player) => player.active);
  const tables = useMemo(() => {
    const ordered = [...active].sort((a, b) => b.score - a.score);
    return Array.from({ length: Math.max(1, Math.ceil(ordered.length / 4)) }, (_, i) => ordered.slice(i * 4, i * 4 + 4));
  }, [active]);

  const addPlayer = () => {
    const name = newName.trim();
    if (!name) return;
    setPlayers((current) => [...current, { name, score: 0, active: true }]);
    setNewName("");
  };
  const toggle = (name: string) => setPlayers((current) => current.map((player) => player.name === name ? { ...player, active: !player.active } : player));
  const changeScore = (name: string, delta: number) => setPlayers((current) => current.map((player) => player.name === name ? { ...player, score: player.score + delta } : player));
  const pair = () => {
    if (active.length < 4) return setNotice("卓を作るには参加者が4人以上必要です");
    setStarted(true); setNotice(`${round}回戦の卓組みを確定しました`);
  };
  const nextRound = () => { setRound((value) => value + 1); setStarted(false); setNotice(`${round + 1}回戦の受付を開始しました`); };

  return <main className="janmatch-shell">
    <header className="janmatch-header"><div><p className="janmatch-kicker">JANMATCH / LOCAL MVP</p><h1>オンライン麻雀大会を、迷わず進行する。</h1><p>卓組み、結果確認、順位表をひとつにまとめた大会運営画面です。</p></div><div className="janmatch-badge">β　ローカル運用</div></header>
    <section className="janmatch-layout">
      <aside className="janmatch-panel janmatch-setup"><p className="janmatch-label">大会設定</p><h2>第1回 JanMatch交流戦</h2><label>大会パスワード<input defaultValue="JMP2026" /></label><div className="janmatch-two"><label>全回戦数<input type="number" defaultValue={4} min={1} /></label><label>1回戦の時間<input defaultValue="60分" /></label></div><label>ルール・お知らせ<textarea defaultValue="東南戦／25000点持ち。ウマは10-20。結果画像を提出してください。" /></label><button className="janmatch-primary" onClick={() => setNotice("大会設定を保存しました")}>大会を保存</button><div className="janmatch-divider" /><p className="janmatch-label">参加者を追加</p><div className="janmatch-add"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="ニックネーム" onKeyDown={(event) => event.key === "Enter" && addPlayer()} /><button onClick={addPlayer}>追加</button></div><div className="janmatch-player-list">{players.map((player) => <button key={player.name} className={player.active ? "is-active" : ""} onClick={() => toggle(player.name)}><span>{player.name}</span><small>{player.active ? "参加" : "受付待ち"}</small></button>)}</div></aside>
      <section className="janmatch-main"><div className="janmatch-toolbar"><div><p className="janmatch-label">進行状況</p><h2>{round}回戦 <span>／ 全4回戦</span></h2></div><div className="janmatch-actions"><span className={started ? "janmatch-state live" : "janmatch-state"}>{started ? "卓確定" : "受付中"}</span><button onClick={pair}>卓組みを確定</button><button className="janmatch-secondary" onClick={nextRound}>次回戦へ</button></div></div><p className="janmatch-notice">●　{notice}</p><div className="janmatch-table-grid">{tables.map((table, index) => <article className="janmatch-table" key={index}><div className="janmatch-table-head"><strong>卓 {index + 1}</strong><span>{started ? "対局中" : "組み合わせ待ち"}</span></div>{table.map((player, seat) => <div className="janmatch-seat" key={player.name}><span className="seat-no">{["東", "南", "西", "北"][seat]}</span><strong>{player.name}</strong><span className="seat-score">{player.score > 0 ? "+" : ""}{player.score.toLocaleString()}</span></div>)}{table.length < 4 && <div className="janmatch-empty">参加者を待っています</div>}</article>)}</div><div className="janmatch-results"><div className="janmatch-results-head"><div><p className="janmatch-label">結果入力（仮）</p><h2>読み取り候補を確認</h2></div><button onClick={() => setNotice("結果画像の受付欄は次の実装で追加します")}>結果画像を追加</button></div><p>いまは点数横の＋／−で動作確認できます。次段階で雀魂の結果スクリーンショットをAI解析し、候補をここに表示します。</p><div className="janmatch-score-list">{[...active].sort((a, b) => b.score - a.score).map((player, index) => <div key={player.name}><span>{index + 1}</span><strong>{player.name}</strong><b>{player.score.toLocaleString()}</b><button onClick={() => changeScore(player.name, 1000)}>＋1,000</button><button onClick={() => changeScore(player.name, -1000)}>−1,000</button></div>)}</div></div></section>
    </section>
  </main>;
}
