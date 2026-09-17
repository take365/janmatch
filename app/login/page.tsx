import Link from "next/link";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <main className="jm-user-shell jm-narrow"><Link className="jm-back" href="/">← 大会一覧</Link><p className="janmatch-kicker">DISCORD LOGIN</p><h1>ログイン</h1><section className="jm-lock-card"><h2>Discordでログイン</h2><p>対象のオンライン麻雀大会サーバーのメンバーだけが利用できます。</p><Link className="jm-primary" href="/api/auth/discord">Discordでログイン</Link><p className="jm-form-note">初回ログイン後に大会表示名と雀魂のゲーム内名を登録します。</p></section></main>;
}
