import { env } from "cloudflare:workers";
import { getConfig } from "../../../lib/discord-auth";
import { deferred, ephemeral, followUpInteraction, interactionAllowed, interactionUser, verifyDiscordSignature, type DiscordInteraction } from "../../../lib/discord-interactions";
import { runJanmatchAgent } from "../../../lib/janmatch-agent";
import { executePendingJanmatchOperation } from "../../../lib/janmatch-operations";
import { getRequestExecutionContext } from "vinext/shims/request-context";

const option = (interaction: DiscordInteraction, name: string) => interaction.data?.options?.find((item) => item.name === name)?.value;

async function handle(interaction: DiscordInteraction) {
  const user = interactionUser(interaction); if (!user) return ephemeral("Discordユーザーを確認できませんでした。");
  const allowed = interactionAllowed(interaction); if (!allowed.ok) return ephemeral(allowed.reason);
  if (interaction.type === 2 && interaction.data?.name === "janmatch") {
    const prompt = typeof option(interaction, "content") === "string" ? String(option(interaction, "content")) : "大会の状態を教えてください";
    const task = runJanmatchAgent({ discordUserId: user.id, guildId: interaction.guild_id, channelId: interaction.channel_id, interactionId: interaction.id, roles: interaction.member?.roles }, prompt).then((content) => {
      const marker = content.match(/\[\[JANMATCH_CONFIRM:([^\]]+)\]\]/);
      const clean = content.replace(/\s*\[\[JANMATCH_CONFIRM:[^\]]+\]\]/, "");
      const components = marker ? [{ type: 1, components: [{ type: 2, style: 3, label: "この操作を実行", custom_id: `janmatch:confirm:${marker[1]}` }] }] : undefined;
      return followUpInteraction(interaction, clean, components);
    }).catch((error) => followUpInteraction(interaction, error instanceof Error ? `処理に失敗しました: ${error.message}` : "処理に失敗しました"));
    getRequestExecutionContext()?.waitUntil(task);
    void task;
    return deferred();
  }
  if (interaction.type === 3 && interaction.data?.custom_id?.startsWith("janmatch:confirm:")) {
    const token = interaction.data.custom_id.slice("janmatch:confirm:".length);
    try {
      const result = await executePendingJanmatchOperation({ discordUserId: user.id, guildId: interaction.guild_id, channelId: interaction.channel_id, roles: interaction.member?.roles }, token);
      return ephemeral(result.ok ? "確認した操作を実行しました。" : "確認操作は完了しませんでした。");
    } catch (error) { return ephemeral(error instanceof Error ? error.message : "確認操作に失敗しました"); }
  }
  return ephemeral("この操作にはまだ対応していません。");
}

export async function POST(request: Request) {
  const body = await request.text(); const config = getConfig();
  if (!config.publicKey) return Response.json({ error: "DISCORD_PUBLIC_KEYが未設定です" }, { status: 503 });
  if (!(await verifyDiscordSignature(request, body))) return Response.json({ error: "Discord署名の検証に失敗しました" }, { status: 401 });
  let interaction: DiscordInteraction;
  try { interaction = JSON.parse(body) as DiscordInteraction; } catch { return Response.json({ error: "不正なJSONです" }, { status: 400 }); }
  if (interaction.type === 1) return Response.json({ type: 1 });
  return Response.json(await handle(interaction));
}
