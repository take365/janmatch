import { env } from "cloudflare:workers";

export type OperationContext = { interactionId?: string; actorUserId?: string; actorDiscordUserId: string; guildId?: string; channelId?: string; roles?: string[] };

export async function beginOperation(context: OperationContext, operationType: string, reason = "", argumentsJson = "") {
  const id = crypto.randomUUID();
  const result = await env.DB.prepare("INSERT OR IGNORE INTO operation_requests (id, interaction_id, actor_user_id, actor_discord_user_id, guild_id, channel_id, operation_type, status, reason, arguments_json, actor_roles_json) VALUES (?, ?, ?, ?, ?, ?, ?, 'received', ?, ?, ?)").bind(id, context.interactionId ?? null, context.actorUserId ?? context.actorDiscordUserId, context.actorDiscordUserId, context.guildId ?? null, context.channelId ?? null, operationType, reason, argumentsJson, JSON.stringify(context.roles ?? [])).run();
  if (!result.meta.changes && context.interactionId) {
    const existing = await env.DB.prepare("SELECT id, status, after_summary as afterSummary, error_message as errorMessage FROM operation_requests WHERE interaction_id = ?").bind(context.interactionId).first<{ id: string; status: string; afterSummary: string; errorMessage: string }>();
    if (existing) return { ...existing, duplicate: true };
  }
  return { id, status: "received", afterSummary: "", errorMessage: "", duplicate: false };
}

export async function finishOperation(id: string, status: "completed" | "rejected" | "failed", afterSummary = "", errorMessage = "") {
  await env.DB.prepare("UPDATE operation_requests SET status = ?, after_summary = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, afterSummary, errorMessage, id).run();
}

export async function requestConfirmation(id: string, token: string, expiresAt: string) {
  await env.DB.prepare("UPDATE operation_requests SET status = 'pending_confirmation', confirmation_token = ?, confirmation_expires_at = ? WHERE id = ?").bind(token, expiresAt, id).run();
}

export async function recordAgentMessage(channelId: string, discordUserId: string, role: "user" | "assistant", content: string, interactionId?: string, tournamentId?: string) {
  await env.DB.prepare("INSERT INTO agent_messages (id, tournament_id, channel_id, discord_user_id, role, content, interaction_id) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), tournamentId ?? null, channelId, discordUserId, role, content.slice(0, 12000), interactionId ?? null).run();
}

export async function recentAgentMessages(channelId: string, limit = 20) {
  const result = await env.DB.prepare("SELECT role, content FROM agent_messages WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?").bind(channelId, limit).all<{ role: "user" | "assistant"; content: string }>();
  return result.results.reverse();
}
