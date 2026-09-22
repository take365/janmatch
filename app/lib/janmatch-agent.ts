import { Agent, run, setDefaultOpenAIKey, tool } from "@openai/agents";
import { z } from "zod";
import { env } from "cloudflare:workers";
import { executeJanmatchOperation, type JanmatchActor, type OperationArgs } from "./janmatch-operations";
import { envOpenAiKey } from "./discord-interactions";
import { recentAgentMessages, recordAgentMessage } from "./operation-audit";
import { getConfig } from "./discord-auth";

const operationSchema = z.object({
  operation: z.enum(["list_tournaments", "get_tournament_state", "get_discord_resources", "join_round", "cancel_round", "join_tournament", "cancel_tournament", "create_tournament", "start", "confirm", "set_room_id", "set_scores", "approve_result", "schedule_round", "cancel_schedule", "provision_tournament_resources", "contact_operator", "report_edit"]),
  tournamentId: z.string().optional(), round: z.number().int().optional(), tableIndex: z.number().int().optional(), expectedVersion: z.number().int().optional(), joined: z.boolean().optional(), roomId: z.string().optional(), scores: z.array(z.number().int()).optional(), deadline: z.number().int().optional(), name: z.string().optional(), gameType: z.string().optional(), startAt: z.string().optional(), rounds: z.number().int().optional(), pairingMode: z.string().optional(), uma: z.array(z.number()).optional(), password: z.string().optional(), notice: z.string().optional(),
});

function apiKey() { const key = envOpenAiKey() ?? (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPENAI_API_KEY; if (key) setDefaultOpenAIKey(key); return key; }

export async function runJanmatchAgent(actor: JanmatchActor, prompt: string) {
  const key = apiKey(); if (!key) throw new Error("OPENAI_API_KEYが設定されていません");
  const history = actor.channelId ? await recentAgentMessages(actor.channelId) : [];
  const operate = tool({ name: "janmatch_operation", description: "JanMatchの大会・回戦・参加・卓・結果を操作または参照する専用ツール。操作対象と入力を確認してから呼び出す。", parameters: operationSchema, execute: async (input) => JSON.stringify(await executeJanmatchOperation(actor, input.operation, input as OperationArgs)) });
  const draft = tool({ name: "tournament_draft", description: "大会作成会話の下書きを保存・取得・削除する専用ツール。大会作成情報が不足している間は保存し、次の発言で取得して会話を再開可能にする。dataJsonは大会名・開始時刻・回戦数・ウマ・ルールなどを含むJSON文字列。", parameters: z.object({ action: z.enum(["get", "save", "delete"]), dataJson: z.string().optional() }), execute: async (input) => {
    if (!env.DB || !actor.channelId) return JSON.stringify({ ok: false, error: "下書き保存先がありません" });
    const id = `${actor.channelId}:${actor.discordUserId}`;
    if (input.action === "get") return JSON.stringify({ ok: true, draft: await env.DB.prepare("SELECT data_json as dataJson, updated_at as updatedAt FROM discord_tournament_drafts WHERE id = ? AND status = 'draft'").bind(id).first() });
    if (input.action === "delete") { await env.DB.prepare("UPDATE discord_tournament_drafts SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run(); return JSON.stringify({ ok: true }); }
    if (!input.dataJson?.trim()) return JSON.stringify({ ok: false, error: "dataJsonが必要です" });
    await env.DB.prepare("INSERT INTO discord_tournament_drafts (id, guild_id, channel_id, discord_user_id, data_json, status) VALUES (?, ?, ?, ?, ?, 'draft') ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, status = 'draft', updated_at = CURRENT_TIMESTAMP").bind(id, actor.guildId ?? null, actor.channelId, actor.discordUserId, input.dataJson.slice(0, 12000)).run();
    return JSON.stringify({ ok: true, saved: true });
  } });
  const config = getConfig();
  if (!config.agentEnabled) throw new Error("運営アシスタントAIは緊急停止中です");
  const agent = new Agent({ name: "JanMatch 運営アシスタントAI", model: config.agentModel, instructions: "あなたはJanMatchの運営アシスタントです。大会別チャンネルの会話を前提に、曖昧な大会・回戦・卓は確認してください。D1へ直接アクセスせず、必ず専用ツールだけを使ってください。大会作成の情報が不足している場合はtournament_draftで既存下書きを取得し、質問した内容を保存して会話を再開可能にしてください。大会作成の最終実行は必ず確認ボタン後に行います。重要な書込みでは実行内容を短く説明し、確認が必要な操作ではツールが返した [[JANMATCH_CONFIRM:...]] マーカーを回答にそのまま含めてください。失敗は隠さず日本語で返します。", tools: [operate, draft] });
  const context = history.map((item) => `${item.role}: ${item.content}`).join("\n");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  let result;
  try {
    result = await run(agent, context ? `${context}\nuser: ${prompt}` : prompt, { maxTurns: 8, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  const output = typeof result.finalOutput === "string" ? result.finalOutput : "処理結果を取得できませんでした";
  if (actor.channelId) { await recordAgentMessage(actor.channelId, actor.discordUserId, "user", prompt, actor.interactionId); await recordAgentMessage(actor.channelId, actor.discordUserId, "assistant", output, actor.interactionId); }
  return output;
}
