import { execFileSync } from "node:child_process";

const players = [
  ["テスト参加者1", "雀魂ユーザー1"], ["テスト参加者2", "雀魂ユーザー2"], ["テスト参加者3", "雀魂ユーザー3"],
  ["テスト参加者4", "雀魂ユーザー4"], ["テスト参加者5", "雀魂ユーザー5"], ["テスト参加者6", "雀魂ユーザー6"],
];
const id = "demo-tournament-issue-4";
const state1 = JSON.stringify({ tables: [
  { label: "A卓", members: players.slice(0, 4).map(([name]) => name), representative: players[0][0], scores: [320, 280, 220, 180], approvals: players.slice(0, 4).map(([name]) => name), resultStatus: "結果確定" },
  { label: "B卓", members: players.slice(4).map(([name]) => name), representative: players[4][0], scores: [520, 480], approvals: players.slice(4).map(([name]) => name), resultStatus: "結果確定" },
] });
const state2 = JSON.stringify({ tables: [
  { label: "A卓", members: players.slice(0, 4).map(([name]) => name), representative: players[1][0], scores: [250, 310, 190, 250], approvals: players.slice(0, 4).map(([name]) => name), resultStatus: "結果確定" },
  { label: "B卓", members: players.slice(4).map(([name]) => name), representative: players[5][0], scores: [470, 530], approvals: players.slice(4).map(([name]) => name), resultStatus: "結果確定" },
] });
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const statements = [
  `INSERT OR REPLACE INTO tournaments (id, owner, name, game_type, start_at, password, rounds, pairing_mode, uma, notice, phase) VALUES (${quote(id)}, 'デモ主催者', '成績一覧デモ大会', '雀魂-じゃんたま-', '2026-09-16T19:00', '', 4, '最終戦だけ順位卓', '[20,10,0,0]', 'Issue #4 確認用。1〜2回戦が終了、3回戦受付中です。', 'active')`,
  `DELETE FROM tournament_entries WHERE tournament_id = ${quote(id)}`,
  `DELETE FROM tournament_rounds WHERE tournament_id = ${quote(id)}`,
  ...players.map(([nickname, gameName], index) => `INSERT OR REPLACE INTO profiles (session_id, nickname, game_name) VALUES (${quote(`seed-issue-4-${index + 1}`)}, ${quote(nickname)}, ${quote(gameName)})`),
  ...players.flatMap(([nickname]) => [1, 2, 3].map((round) => `INSERT INTO tournament_entries (id, tournament_id, nickname, round, joined) VALUES (${quote(`${id}:${nickname}:${round}`)}, ${quote(id)}, ${quote(nickname)}, ${round}, 1)`)),
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(id)}, 1, '確定', ${quote(state1)}, 0)`,
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(id)}, 2, '確定', ${quote(state2)}, 0)`,
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(id)}, 3, '受付中', '{"tables":[],"deadline":4102444800000}', 0)`,
  `INSERT INTO tournament_rounds (tournament_id, round, status, state_json, version) VALUES (${quote(id)}, 4, '受付前', '{"tables":[]}', 0)`,
];
const sql = `${statements.join(";\n")};`;
execFileSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "janmatch-local", "--local", "--command", sql], { stdio: "inherit" });
