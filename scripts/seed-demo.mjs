import { execFileSync } from "node:child_process";

const players = [
  ["テスト参加者1", "雀魂ユーザー1"], ["テスト参加者2", "雀魂ユーザー2"], ["テスト参加者3", "雀魂ユーザー3"], ["テスト参加者4", "雀魂ユーザー4"],
  ["テスト参加者5", "雀魂ユーザー5"], ["テスト参加者6", "雀魂ユーザー6"], ["テスト参加者7", "雀魂ユーザー7"], ["テスト参加者8", "雀魂ユーザー8"],
];
const id = "demo-tournament-issue-4";
const table = (members, representative, scores) => ({ label: `卓${String.fromCharCode(65 + (representative ? 0 : 1))}`, members, representative, scores, approvals: members, resultStatus: "結果確定" });
const state1 = JSON.stringify({ tables: [
  { ...table(players.slice(0, 4).map(([name]) => name), players[0][0], [32000, 28000, 22000, 18000]), label: "卓A" },
  { ...table(players.slice(4).map(([name]) => name), players[4][0], [30000, 27000, 23000, 20000]), label: "卓B" },
] });
const state2 = JSON.stringify({ tables: [
  { ...table(players.slice(0, 4).map(([name]) => name), players[1][0], [25000, 31000, 19000, 25000]), label: "卓A" },
  { ...table(players.slice(4).map(([name]) => name), players[5][0], [26000, 24000, 29000, 21000]), label: "卓B" },
] });
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const statements = [
  `INSERT OR REPLACE INTO tournaments (id, owner, name, game_type, start_at, password, rounds, pairing_mode, uma, notice, phase) VALUES (${quote(id)}, 'デモ主催者', '成績一覧デモ大会', '雀魂-じゃんたま-', '2026-09-16T19:00', '', 4, '最終戦だけ順位卓', '[20,10,0,0]', 'Issue #4 確認用。1〜2回戦が終了、3回戦受付中です。', 'active')`,
  `DELETE FROM tournament_entries WHERE tournament_id = ${quote(id)}`,
  `DELETE FROM tournament_rounds WHERE tournament_id = ${quote(id)}`,
  ...players.map(([nickname, gameName], index) => `INSERT OR REPLACE INTO profiles (session_id, nickname, game_name) VALUES (${quote(`seed-issue-4-${index + 1}`)}, ${quote(nickname)}, ${quote(gameName)})`),
  ...players.flatMap(([nickname, gameName]) => [1, 2, 3].map((round) => `INSERT INTO tournament_entries (id, tournament_id, nickname, game_name, round, joined) VALUES (${quote(`${id}:${nickname}:${round}`)}, ${quote(id)}, ${quote(nickname)}, ${quote(gameName)}, ${round}, 1)`)),
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(id)}, 1, '確定', ${quote(state1)}, 0)`,
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(id)}, 2, '確定', ${quote(state2)}, 0)`,
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(id)}, 3, '受付中', '{"tables":[],"deadline":4102444800000}', 0)`,
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(id)}, 4, '受付前', '{"tables":[]}', 0)`,
];
execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "janmatch-local", "--local", "--command", `${statements.join(";\n")};`], { stdio: "inherit" });
