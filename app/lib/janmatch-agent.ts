import { Agent, run, setDefaultOpenAIKey, tool } from "@openai/agents";
import { z } from "zod";
import { env } from "cloudflare:workers";
import { executeJanmatchOperation, type JanmatchActor, type OperationArgs } from "./janmatch-operations";
import { envOpenAiKey } from "./discord-interactions";
import { recentAgentMessages, recordAgentMessage } from "./operation-audit";

const operationSchema = z.object({
  operation: z.enum(["list_tournaments", "get_tournament_state", "join_round", "cancel_round", "create_tournament", "start", "confirm", "set_room_id", "set_scores", "approve_result", "schedule_round", "cancel_schedule"]),
  tournamentId: z.string().optional(), round: z.number().int().optional(), tableIndex: z.number().int().optional(), expectedVersion: z.number().int().optional(), joined: z.boolean().optional(), roomId: z.string().optional(), scores: z.array(z.number().int()).optional(), deadline: z.number().int().optional(), name: z.string().optional(), gameType: z.string().optional(), startAt: z.string().optional(), rounds: z.number().int().optional(), pairingMode: z.string().optional(), uma: z.array(z.number()).optional(), password: z.string().optional(), notice: z.string().optional(),
});

function apiKey() { const key = envOpenAiKey() ?? (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.OPENAI_API_KEY; if (key) setDefaultOpenAIKey(key); return key; }

export async function runJanmatchAgent(actor: JanmatchActor, prompt: string) {
  const key = apiKey(); if (!key) throw new Error("OPENAI_API_KEYが設定されていません");
  const history = actor.channelId ? await recentAgentMessages(actor.channelId) : [];
  const operate = tool({ name: "janmatch_operation", description: "JanMatchの大会・回戦・参加・卓・結果を操作または参照する専用ツール。操作対象と入力を確認してから呼び出す。", parameters: operationSchema, execute: async (input) => JSON.stringify(await executeJanmatchOperation(actor, input.operation, input as OperationArgs)) });
  const agent = new Agent({ name: "JanMatch 運営アシスタントAI", model: "gpt-5.6-luna", instructions: "あなたはJanMatchの運営アシスタントです。大会別チャンネルの会話を前提に、曖昧な大会・回戦・卓は確認してください。D1へ直接アクセスせず、必ずjanmatch_operationだけを使ってください。重要な書込みでは実行内容を短く説明し、必要なら確認を求めます。失敗は隠さず日本語で返します。", tools: [operate] });
  const context = history.map((item) => `${item.role}: ${item.content}`).join("\n");
  const result = await run(agent, context ? `${context}\nuser: ${prompt}` : prompt, { maxTurns: 8 });
  const output = typeof result.finalOutput === "string" ? result.finalOutput : "処理結果を取得できませんでした";
  if (actor.channelId) { await recordAgentMessage(actor.channelId, actor.discordUserId, "user", prompt, actor.interactionId); await recordAgentMessage(actor.channelId, actor.discordUserId, "assistant", output, actor.interactionId); }
  return output;
}
