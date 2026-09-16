import Link from "next/link";

export default function AdminPage() {
  return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><p className="janmatch-kicker">ORGANIZER CONSOLE</p><h1>大会管理</h1><section className="jm-lock-card"><h2>管理する大会を選択してください</h2><p>大会の受付、卓組み、ルームID、点数、承認状態は各大会のD1状態を表示します。</p><Link className="jm-action-admin" href="/">大会一覧を開く</Link></section></main>;
}
