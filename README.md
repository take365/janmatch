# JanMatch

オンライン麻雀大会の運営を支援するシステムです。

現在はローカルMVPとして、Discord OAuth2でログインしたユーザーが次の運営フローを画面上で確認できます。

- 大会名・パスワード・回戦数・制限時間・ルールの設定
- DiscordユーザーIDに紐づく参加者受付
- 参加者の参加／受付待ち切り替え
- 4人卓の仮組みと回戦進行
- 順位表と点数の仮入力
- 結果画像のAI読み取りを追加するための確認欄

大会メタデータ、参加登録、プロフィール、回戦の受付状態・卓・ルームID・点数・承認状態はCloudflare D1に保存します。ブラウザ側の永続ストレージは使用しません。回戦状態には更新バージョンを持たせ、同時更新は競合として扱います。

## 起動

```bash
npm install
npm run db:local:migrate
npm run dev
```

ブラウザで <http://localhost:3000> を開きます。

## Discordログイン（Issue #1）

Discord Developer PortalでOAuth2アプリケーションを作成し、Redirect URIに `http://localhost:3000/api/auth/discord/callback` を登録します。Botユーザーの登録はこのログイン機能には不要です。

ローカルでは `.dev.vars` に次の秘密値・設定値を用意します。`DISCORD_CLIENT_SECRET` はリポジトリへ登録しません。

```text
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_GUILD_ID=対象DiscordサーバーのGuild ID
APP_ORIGIN=http://localhost:3000
```

`npm run db:local:migrate` 実行後、`/login` からDiscordログインを開始できます。対象Guildのメンバーであることを確認し、セッション値はハッシュ化してD1へ保存します。

## ローカルD1の初期化・確認用シード

既存のローカルD1大会データは認証移行時に保持・移行しません。ローカルD1を初期化すると、`.wrangler/state/v3/d1` 配下のこのプロジェクト専用データを削除し、`0002` 以降の現行マイグレーションを最初から適用した後、DiscordユーザーID・`owner_user_id`・`tournament_entries.user_id`・卓の `memberIds` / `representativeUserId` を含む確認用大会を再作成します。実行前に開発サーバーを停止してください。

```bash
npm run db:local:reset
```

シード主催者を実際のDiscordユーザーに合わせる場合は、DiscordのユーザーIDを指定して実行します。指定したユーザーが次回OAuthログインすると、シード大会の主催者として管理画面を確認できます。

```powershell
$env:JANMATCH_SEED_DISCORD_USER_ID="DiscordユーザーID"
npm run db:local:reset
Remove-Item Env:JANMATCH_SEED_DISCORD_USER_ID
```

初期化後の確認手順は、Discordログイン、プロフィール確認、シード大会の管理画面表示、1回戦の参加者確認、代表者としてのルームID・結果登録、参加者としての結果承認です。確認後は `npm run dev` でローカルサーバーを起動します。

## 今後の実装

雀魂の対局結果スクリーンショット解析、点数・ウマ計算、Discord進行Bot、公開環境へのD1適用を順に追加します。
