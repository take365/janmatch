import { env } from "cloudflare:workers";
import { getConfig } from "../../../lib/discord-auth";
import { deferred, ephemeral, followUpInteraction, interactionAllowed, interactionUser, verifyDiscordSignature, type DiscordInteraction } from "../../../lib/discord-interactions";
import { runJanmatchAgent } from "../../../lib/janmatch-agent";
import { finishOperation } from "../../../lib/operation-audit";
import { getRequestExecutionContext } from "vinext/shims/request-context";

const option = (interaction: DiscordInteraction, name: string) => interaction.data?.options?.find((item) => item.name === name)?.value;

async function handle(interaction: DiscordInteraction) {
  const user = interactionUser(interaction); if (!user) return ephemeral("Discordユーザーを確認できませんでした。");
  const allowed = interactionAllowed(interaction); if (!allowed.ok) return ephemeral(allowed.reason);
  if (interaction.type === 2 && interaction.data?.name === "janmatch") {
    const prompt = typeof option(interaction, "content") === "string" ? String(option(interaction, "content")) : "大会の状態を教えてください";
    const task = runJanmatchAgent({ discordUserId: user.id, guildId: interaction.guild_id, channelId: interaction.channel_id, interactionId: interaction.id, roles: interaction.member?.roles }, prompt).then((content) => followUpInteraction(interaction, content)).catch((error) => followUpInteraction(interaction, error instanceof Error ? `処理に失敗しました: ${error.message}` : "処理に失敗しました"));
    getRequestExecutionContext()?.waitUntil(task);
    void task;
    return deferred();
  }
  if (interaction.type === 3 && interaction.data?.custom_id?.startsWith("janmatch:confirm:")) {
    const token = interaction.data.custom_id.slice("janmatch:confirm:".length);
    const row = await env.DB.prepare("SELECT id, actor_discord_user_id as actorDiscordUserId, status FROM operation_requests WHERE confirmation_token = ?").bind(token).first<{ id: string; actorDiscordUserId: string; status: string }>();
    if (!row || row.status !== "pending_confirmation" || row.actorDiscordUserId !== user.id) return ephemeral("確認操作が無効、または期限切れです。");
    await finishOperation(row.id, "completed", JSON.stringify({ confirmedBy: user.id })); return ephemeral("確認を受け付けました。処理結果を確認してください。");
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
