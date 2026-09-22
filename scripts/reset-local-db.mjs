import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const localState = resolve(root, ".wrangler", "state", "v3", "d1");
const ownerDiscordId = process.env.JANMATCH_SEED_DISCORD_USER_ID || "seed-owner-discord-id";
const users = [
  [ownerDiscordId, ownerDiscordId, "きたろう", "きたろう"],
  ["seed-player-discord-2", "seed-player-discord-2", "テスト参加者2", "雀魂ユーザー2"],
  ["seed-player-discord-3", "seed-player-discord-3", "テスト参加者3", "雀魂ユーザー3"],
  ["seed-player-discord-4", "seed-player-discord-4", "テスト参加者4", "雀魂ユーザー4"],
];
const tournamentId = "sample-discord-tournament";
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const execWrangler = (args) => execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args], { cwd: root, stdio: "inherit" });

console.log("ローカルD1を初期化します:", localState);
rmSync(localState, { recursive: true, force: true });
execWrangler(["d1", "migrations", "apply", "janmatch-local", "--local"]);

const members = users.map(([id, , nickname]) => nickname);
const memberIds = users.map(([id]) => id);
const state = JSON.stringify({ tables: [{
  label: "卓A",
  members,
  memberIds,
  representative: members[0],
  representativeUserId: memberIds[0],
  scores: [32000, 28000, 22000, 18000],
  approvals: [],
  resultStatus: "結果登録済み（承認待ち）",
}] });
const statements = [
  `INSERT INTO users (id, discord_user_id, discord_username, discord_nickname, nickname, game_name) VALUES ${users.map(([id, discordId, nickname, gameName]) => `(${quote(id)}, ${quote(discordId)}, ${quote(nickname)}, ${quote(nickname)}, ${quote(nickname)}, ${quote(gameName)})`).join(", ")}`,
  `INSERT INTO tournaments (id, owner, owner_user_id, name, game_type, start_at, password, rounds, pairing_mode, uma, notice, phase) VALUES (${quote(tournamentId)}, ${quote(users[0][2])}, ${quote(users[0][0])}, 'Discord認証確認大会', '雀魂-じゃんたま-', '2026-09-20T19:00', '', 4, '最終戦だけ順位卓', '[20,10,0,0]', 'DiscordユーザーID基準の確認用。1回戦は結果承認待ちです。', 'active')`,
  ...users.flatMap(([userId, , nickname, gameName]) => [1, 2].map((round) => `INSERT INTO tournament_entries (id, tournament_id, user_id, nickname, game_name, round, joined) VALUES (${quote(`${tournamentId}:${userId}:${round}`)}, ${quote(tournamentId)}, ${quote(userId)}, ${quote(nickname)}, ${quote(gameName)}, ${round}, 1)`)),
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(tournamentId)}, 1, '確定', ${quote(state)}, 0)`,
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(tournamentId)}, 2, '受付前', '{"tables":[]}', 0)`,
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(tournamentId)}, 3, '受付前', '{"tables":[]}', 0)`,
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(tournamentId)}, 4, '受付前', '{"tables":[]}', 0)`,
];
execWrangler(["d1", "execute", "janmatch-local", "--local", "--command", `${statements.join(";\n")};`]);
console.log("ローカルD1の初期化と確認用シードが完了しました。");
console.log("実Discordユーザーを主催者にする場合: JANMATCH_SEED_DISCORD_USER_ID=<DiscordユーザーID> npm run db:local:reset");
