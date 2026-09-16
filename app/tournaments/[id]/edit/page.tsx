"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function EditTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tournament, setTournament] = useState<any>(null);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const list = JSON.parse(window.localStorage.getItem("janmatch:tournaments") ?? "[]");
    const found = list.find((item: any) => item.id === id);
    const nickname = window.localStorage.getItem("janmatch:nickname") ?? "";
    if (!found || found.owner !== nickname || (found.phase ?? "before") !== "before") { setError("開催前の大会で、作成者本人のみ編集できます。"); return; }
    setTournament(found); setName(found.name); setNotice(found.notice ?? "");
  }, [id]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!tournament || !name.trim()) return; const list = JSON.parse(window.localStorage.getItem("janmatch:tournaments") ?? "[]"); window.localStorage.setItem("janmatch:tournaments", JSON.stringify(list.map((item: any) => item.id === id ? { ...item, name: name.trim(), notice } : item))); router.push("/"); };
  return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><p className="janmatch-kicker">TOURNAMENT SETTINGS</p><h1>大会を編集</h1>{error ? <section className="jm-lock-card"><p className="jm-error">{error}</p></section> : tournament && <form className="jm-form-card jm-create-form" onSubmit={submit}><p className="jm-form-note">主催者：{tournament.owner}</p><label>大会名<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} /></label><label>ルール・お知らせ<textarea value={notice} onChange={(event) => setNotice(event.target.value)} /></label><div className="jm-form-actions"><Link className="jm-cancel" href="/">キャンセル</Link><button className="jm-primary" type="submit">変更を保存</button></div></form>}</main>;
}
