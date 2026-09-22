import { env } from "cloudflare:workers";
import { getConfig } from "./discord-auth";

const hexToBytes = (value: string) => {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
};

const concat = (first: Uint8Array, second: Uint8Array) => {
  const result = new Uint8Array(first.length + second.length); result.set(first); result.set(second, first.length); return result;
};

export async function verifyDiscordSignature(request: Request, body: string): Promise<boolean> {
  const config = getConfig(); const signature = request.headers.get("x-signature-ed25519"); const timestamp = request.headers.get("x-signature-timestamp");
  if (!config.publicKey || !signature || !timestamp) return false;
  const publicKey = hexToBytes(config.publicKey); const signed = new TextEncoder().encode(timestamp + body); const signatureBytes = hexToBytes(signature);
  if (!publicKey || !signatureBytes) return false;
  try {
    const key = await crypto.subtle.importKey("raw", publicKey, { name: "Ed25519" } as AlgorithmIdentifier, false, ["verify"]);
    return await crypto.subtle.verify({ name: "Ed25519" } as AlgorithmIdentifier, key, signatureBytes, signed);
  } catch { return false; }
}

export type DiscordInteraction = {
  id: string; token: string; type: number; guild_id?: string; channel_id?: string;
  member?: { user?: { id: string; username?: string; global_name?: string }; roles?: string[] };
  user?: { id: string; username?: string; global_name?: string };
  data?: { name?: string; custom_id?: string; options?: Array<{ name: string; value?: unknown }>; components?: Array<{ components?: Array<{ custom_id?: string; value?: string }> }> };
};

export function interactionUser(interaction: DiscordInteraction) { return interaction.member?.user ?? interaction.user ?? null; }

export function interactionAllowed(interaction: DiscordInteraction): { ok: true } | { ok: false; reason: string } {
  const config = getConfig();
  if (!config.agentEnabled) return { ok: false, reason: "運営アシスタントAIは緊急停止中です" };
  if (!config.guildId || !config.allowedChannelIds?.length) return { ok: false, reason: "Discordの利用Guild・チャンネルが未設定です" };
  if (config.guildId && interaction.guild_id !== config.guildId) return { ok: false, reason: "対象Guild以外からは利用できません" };
  if (!interaction.channel_id || !config.allowedChannelIds.includes(interaction.channel_id)) return { ok: false, reason: "このチャンネルでは利用できません" };
  return { ok: true };
}

export function hasOperatorRole(interaction: DiscordInteraction): boolean {
  const roleId = getConfig().operatorRoleId; return Boolean(roleId && interaction.member?.roles?.includes(roleId));
}

export type DiscordResponse = { type: number; data?: { content?: string; flags?: number; components?: unknown[]; custom_id?: string; title?: string } };
export const ephemeral = (content: string, components?: unknown[]): DiscordResponse => ({ type: 4, data: { content, flags: 64, ...(components ? { components } : {}) } });
export const deferred = (): DiscordResponse => ({ type: 5, data: { flags: 64 } });
export const modal = (customId: string, title: string, components: unknown[]): DiscordResponse => ({ type: 9, data: { custom_id: customId, title, components } });

export async function followUpInteraction(interaction: DiscordInteraction, content: string, components?: unknown[]) {
  const config = getConfig(); if (!config.applicationId || !config.botToken) throw new Error("Discord Bot設定が未完了です");
  const response = await fetch(`https://discord.com/api/v10/webhooks/${config.applicationId}/${interaction.token}`, { method: "POST", headers: { authorization: `Bot ${config.botToken}`, "content-type": "application/json" }, body: JSON.stringify({ content, ...(components ? { components } : {}) }) });
  if (!response.ok) throw new Error(`Discordへの完了通知に失敗しました（${response.status}）`);
}

export function envOpenAiKey(): string | undefined {
  const values = env as unknown as Record<string, unknown>; return typeof values.OPENAI_API_KEY === "string" ? values.OPENAI_API_KEY : undefined;
}
