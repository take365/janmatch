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
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_CRON_SECRET=ローカル確認用のランダムな秘密値
DISCORD_APPLICATION_ID=Discord Application ID（通常はDISCORD_CLIENT_IDと同じ）
DISCORD_PUBLIC_KEY=Discord Developer Portalの公開キー
DISCORD_BOT_TOKEN=Botトークン
DISCORD_INTERNAL_SECRET=Discord InteractionからJanMatch専用ツールへ渡す内部共有シークレット
DISCORD_OPERATOR_ROLE_ID=運営ロールのID
DISCORD_ALLOWED_CHANNEL_IDS=利用を許可するChannel IDをカンマ区切り
DISCORD_OPERATOR_CHANNEL_ID=運営限定チャンネルのID
DISCORD_ANNOUNCEMENT_CHANNEL_ID=大会告知チャンネルのID（省略時は許可チャンネルの先頭）
DISCORD_AGENT_MODEL=gpt-5.6-luna（省略可）
DISCORD_AGENT_ENABLED=true（falseで緊急停止）
```

`npm run db:local:migrate` 実行後、`/login` からDiscordログインを開始できます。対象Guildのメンバーであることを確認し、セッション値はハッシュ化してD1へ保存します。

大会進行通知を使う場合は、Discordの対象チャンネルでIncoming Webhookを作成し、`DISCORD_WEBHOOK_URL` を `.dev.vars` または本番のシークレットへ設定します。Webhook URLはD1・画面・リポジトリ・通常ログには保存・表示しません。通知送信に失敗しても大会状態の更新は成功し、サーバーログで失敗を確認できます。送信済みイベントはD1で大会・回戦・通知種別ごとに一意管理します。

Discord操作基盤を使う場合は、同じApplicationのSpidey Botを再利用し、Botトークン・公開キー・Guild ID・許可チャンネル・運営ロールを設定します。Guildコマンドは `npm run discord:register` で開発Guildへ登録します。Interactionは署名検証後にJanMatch専用ツールを実行し、操作要求と結果をD1へ監査記録します。

Interactionは `DISCORD_ALLOWED_CHANNEL_IDS` が未設定の場合は拒否します。大会操作など運営ロールが必要な操作は `DISCORD_OPERATOR_ROLE_ID` が未設定の場合も拒否します。書込み操作は確認待ちとしてD1へ保存され、Discordの確認ボタン押下後に実行されます。確認トークンの有効期限は5分です。

参加者向けのDiscord操作は、対象チャンネルで `/janmatch` に `参加メニュー` と入力すると表示されるボタンから利用できます。大会全体の参加申請・取消は「受付中の全回戦」を対象にし、回戦単位の参加登録・取消とは別に表示します。ルームID・結果の申告、結果承認、編集申告、運営への問い合わせはモーダルで入力します。編集申告と問い合わせは `DISCORD_OPERATOR_CHANNEL_ID` が設定されていれば運営チャンネルへ転送し、未設定でもD1監査ログへ記録します。通常メンションはGateway常駐処理を必要とするため、現時点では対応していません。

運営は `/janmatch` に `運営メニュー` と入力すると、大会作成、回戦操作、大会ロール・専用チャンネル・告知メッセージ作成の導線を表示できます。Discord資源のIDと状態はD1の `tournament_discord_resources` に保存し、途中失敗は `failed` として約60秒後から定時巡回で再実行します。ロール同期の失敗は `tournament_role_sync` に保存し、定時巡回で再試行します。大会資源の削除予定は全回戦・全卓の結果確定後に大会終了時点から7日後として設定します。

30分前・5分前通知は、WorkersのCron Trigger（毎分）から `/api/tournaments/notifications` を巡回して発火します。Cron経路は `DISCORD_CRON_SECRET` で保護します。ローカルでは開発サーバー起動後に `npm run notifications:check` を実行して同じ確認経路を手動確認できます。定時巡回は通知だけを行い、大会状態の正本は引き続きD1です。

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
