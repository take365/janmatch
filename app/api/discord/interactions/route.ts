import { env } from "cloudflare:workers";
import { ensureDiscordUser, getConfig, updateDiscordProfile } from "../../../lib/discord-auth";
import { deferred, ephemeral, followUpInteraction, interactionAllowed, interactionUser, modal, verifyDiscordSignature, type DiscordInteraction } from "../../../lib/discord-interactions";
import { runJanmatchAgent } from "../../../lib/janmatch-agent";
import { executePendingJanmatchOperation } from "../../../lib/janmatch-operations";
import { getRequestExecutionContext } from "vinext/shims/request-context";

const option = (interaction: DiscordInteraction, name: string) => interaction.data?.options?.find((item) => item.name === name)?.value;
const field = (interaction: DiscordInteraction, name: string) => interaction.data?.components?.flatMap((row) => row.components ?? []).find((item) => item.custom_id === name)?.value?.trim() ?? "";

const button = (custom_id: string, label: string, style = 2) => ({ type: 2, style, label, custom_id });
const row = (...components: unknown[]) => ({ type: 1, components });
const participantMenu = [
  row(button("janmatch:modal:tournament-join", "大会全体に参加申請", 3), button("janmatch:modal:tournament-cancel", "大会参加を取り消す", 2)),
  row(button("janmatch:modal:join", "回戦に参加登録", 3), button("janmatch:modal:cancel", "回戦参加を取り消す", 2)),
  row(button("janmatch:modal:room", "ルームIDを申告", 2), button("janmatch:modal:scores", "結果を申告", 3)),
  row(button("janmatch:modal:approve", "結果を承認", 3), button("janmatch:modal:edit", "編集を申告", 2)),
  row(button("janmatch:modal:contact", "運営へ問い合わせ", 1), button("janmatch:modal:state", "大会・回戦を照会", 2), button("janmatch:modal:profile", "利用者登録", 2)),
];
const operatorMenu = [
  row(button("janmatch:modal:operator-create", "大会作成（会話）", 3), button("janmatch:modal:operator-resources", "大会資源を作成", 2)),
  row(button("janmatch:modal:operator-start", "回戦受付を開始", 3), button("janmatch:modal:operator-confirm", "卓を確定", 3)),
  row(button("janmatch:modal:operator-schedule", "受付を予約", 2), button("janmatch:modal:operator-cancel-schedule", "予約を取消", 2)),
];
const input = (custom_id: string, label: string, required = true, style = 1) => ({ type: 1, components: [{ type: 4, custom_id, label, style, required, max_length: style === 2 ? 2000 : 200 }] });
const operationModal = (customId: string, title: string, components: unknown[]) => modal(customId, title, components);
const tableLabel = (value: string) => { const number = Number(value); return Number.isInteger(number) && number > 0 && number <= 26 ? `卓${String.fromCharCode(64 + number)}` : `卓${value}`; };

function modalFor(customId: string) {
  if (customId === "janmatch:modal:tournament-join" || customId === "janmatch:modal:tournament-cancel") return operationModal(`janmatch:form:${customId.endsWith("join") ? "tournament-join" : "tournament-cancel"}`, customId.endsWith("join") ? "大会全体に参加申請" : "大会参加を取り消す", [input("tournamentId", "大会ID")]);
  if (customId === "janmatch:modal:join" || customId === "janmatch:modal:cancel") return operationModal(`janmatch:form:${customId.endsWith("join") ? "join" : "cancel"}`, customId.endsWith("join") ? "回戦に参加登録" : "参加を取り消す", [input("tournamentId", "大会ID"), input("round", "回戦番号")]);
  if (customId === "janmatch:modal:room") return operationModal("janmatch:form:room", "ルームIDを申告", [input("tournamentId", "大会ID"), input("round", "回戦番号"), input("tableIndex", "卓番号（1から）"), input("roomId", "ルームID")]);
  if (customId === "janmatch:modal:scores") return operationModal("janmatch:form:scores", "結果を申告", [input("tournamentId", "大会ID"), input("round", "回戦番号"), input("tableIndex", "卓番号（1から）"), input("scores", "生点4人分（例: 25000,25000,25000,25000）")]);
  if (customId === "janmatch:modal:approve") return operationModal("janmatch:form:approve", "結果を承認", [input("tournamentId", "大会ID"), input("round", "回戦番号"), input("tableIndex", "卓番号（1から）")]);
  if (customId === "janmatch:modal:edit") return operationModal("janmatch:form:edit", "結果の編集を申告", [input("tournamentId", "大会ID"), input("round", "回戦番号"), input("notice", "編集内容", true, 2)]);
  if (customId === "janmatch:modal:state") return operationModal("janmatch:form:state", "大会・回戦を照会", [input("tournamentId", "大会ID")]);
  if (customId === "janmatch:modal:profile") return operationModal("janmatch:form:profile", "利用者登録", [input("nickname", "JanMatch表示名"), input("gameName", "ゲーム内名")]);
  if (customId === "janmatch:modal:operator-create") return operationModal("janmatch:form:operator-create", "大会作成（会話）", [input("prompt", "大会の希望内容", true, 2)]);
  if (customId === "janmatch:modal:operator-resources") return operationModal("janmatch:form:operator-resources", "大会Discord資源を作成", [input("tournamentId", "大会ID")]);
  if (["start", "confirm", "schedule", "cancel-schedule"].some((action) => customId === `janmatch:modal:operator-${action}`)) return operationModal(`janmatch:form:operator-${customId.slice("janmatch:modal:operator-".length)}`, "大会回戦を操作", [input("tournamentId", "大会ID"), input("round", "回戦番号"), ...(customId.endsWith("schedule") ? [input("deadline", "締切時刻（ISO日時または秒数）")] : [])]);
  return operationModal("janmatch:form:contact", "運営へ問い合わせ", [input("tournamentId", "大会ID", false), input("notice", "問い合わせ内容", true, 2)]);
}

function runAgentInteraction(interaction: DiscordInteraction, actor: { discordUserId: string; guildId?: string; channelId?: string; interactionId?: string; roles?: string[] }, prompt: string, components?: unknown[]) {
  const task = runJanmatchAgent(actor, prompt).then((content) => {
    const marker = content.match(/\[\[JANMATCH_CONFIRM:([^\]]+)\]\]/);
    const clean = content.replace(/\s*\[\[JANMATCH_CONFIRM:[^\]]+\]\]/, "");
    const confirmation = marker ? [row(button(`janmatch:confirm:${marker[1]}`, "この操作を実行", 3))] : undefined;
    return followUpInteraction(interaction, clean, components ?? confirmation);
  }).catch((error) => followUpInteraction(interaction, error instanceof Error ? `処理に失敗しました: ${error.message}` : "処理に失敗しました"));
  getRequestExecutionContext()?.waitUntil(task);
  return deferred();
}

async function handle(interaction: DiscordInteraction) {
  const user = interactionUser(interaction); if (!user) return ephemeral("Discordユーザーを確認できませんでした。");
  const allowed = interactionAllowed(interaction); if (!allowed.ok) return ephemeral(allowed.reason);
  try { await ensureDiscordUser(user); } catch (error) { return ephemeral(error instanceof Error ? error.message : "Discordユーザー登録に失敗しました"); }
  if (interaction.type === 2 && interaction.data?.name === "janmatch") {
    const prompt = typeof option(interaction, "content") === "string" ? String(option(interaction, "content")) : "大会の状態を教えてください";
    const actor = { discordUserId: user.id, guildId: interaction.guild_id, channelId: interaction.channel_id, interactionId: interaction.id, roles: interaction.member?.roles };
    if (/^運営メニュー(?:を表示|表示)?$/u.test(prompt.trim())) return runAgentInteraction(interaction, actor, prompt, operatorMenu);
    if (/^(参加|操作|利用)?メニュー(?:を表示|表示)?$/u.test(prompt.trim())) return runAgentInteraction(interaction, actor, prompt, participantMenu);
    return runAgentInteraction(interaction, actor, prompt);
  }
  if (interaction.type === 3 && interaction.data?.custom_id === "janmatch:menu") return ephemeral("参加者向け操作を選択してください。", participantMenu);
  if (interaction.type === 3 && interaction.data?.custom_id === "janmatch:operator-menu") return ephemeral("運営操作を選択してください。実行時に運営ロールを再確認します。", operatorMenu);
  if (interaction.type === 3 && interaction.data?.custom_id?.startsWith("janmatch:modal:")) {
    return modalFor(interaction.data.custom_id);
  }
  if (interaction.type === 5 && interaction.data?.custom_id?.startsWith("janmatch:form:")) {
    const form = interaction.data.custom_id.slice("janmatch:form:".length);
    const tournamentId = field(interaction, "tournamentId");
    const round = Number(field(interaction, "round"));
    if (form === "profile") {
      try { await updateDiscordProfile(user.id, field(interaction, "nickname"), field(interaction, "gameName")); return ephemeral("利用者登録を更新しました。大会参加メニューから続けて申請できます。"); } catch (error) { return ephemeral(error instanceof Error ? error.message : "利用者登録に失敗しました"); }
    }
    if ((form !== "contact" && !tournamentId) || (["join", "cancel", "room", "scores", "edit", "approve", "operator-start", "operator-confirm", "operator-schedule", "operator-cancel-schedule"].includes(form) && !Number.isInteger(round))) return ephemeral("大会IDと回戦番号を正しく入力してください。");
    const actor = { discordUserId: user.id, guildId: interaction.guild_id, channelId: interaction.channel_id, interactionId: interaction.id, roles: interaction.member?.roles };
    const prompts: Record<string, string> = {
      join: `大会ID「${tournamentId}」の第${round}回戦に参加登録して`,
      cancel: `大会ID「${tournamentId}」の第${round}回戦の参加登録を取り消して`,
      "tournament-join": `大会ID「${tournamentId}」に大会全体で参加申請して。受付中の全回戦を対象にし、対象回戦数も結果に表示して`,
      "tournament-cancel": `大会ID「${tournamentId}」の大会参加を取り消して。受付中の全回戦を対象にし、対象回戦数も結果に表示して`,
      room: `大会ID「${tournamentId}」の第${round}回戦、${tableLabel(field(interaction, "tableIndex"))}（内部番号${Math.max(0, Number(field(interaction, "tableIndex")) - 1)}）のルームIDを「${field(interaction, "roomId")}」に登録して`,
      scores: `大会ID「${tournamentId}」の第${round}回戦、${tableLabel(field(interaction, "tableIndex"))}（内部番号${Math.max(0, Number(field(interaction, "tableIndex")) - 1)}）の結果を生点「${field(interaction, "scores")}」で登録して`,
      approve: `大会ID「${tournamentId}」の第${round}回戦、${tableLabel(field(interaction, "tableIndex"))}（内部番号${Math.max(0, Number(field(interaction, "tableIndex")) - 1)}）の結果を承認して`,
      edit: `大会ID「${tournamentId}」の第${round}回戦について、次の編集申告を運営へ転送して: ${field(interaction, "notice")}`,
      state: `大会ID「${tournamentId}」の大会・回戦状態を照会して`,
      contact: `大会ID「${tournamentId || "（指定なし）"}」について、次の問い合わせを運営へ転送して: ${field(interaction, "notice")}`,
      "operator-create": `次の希望内容で大会作成を進めてください。不足情報は質問し、初期ウマは20/10/0/0を提案してください。最終的な作成は確認ボタン後に行ってください: ${field(interaction, "prompt")}`,
      "operator-resources": `大会ID「${tournamentId}」のDiscord大会ロール・専用チャンネル・告知メッセージを作成して`,
      "operator-start": `大会ID「${tournamentId}」の第${round}回戦の受付を開始して`,
      "operator-confirm": `大会ID「${tournamentId}」の第${round}回戦の参加者を確定して卓組みを実行して`,
      "operator-schedule": `大会ID「${tournamentId}」の第${round}回戦の受付終了を${field(interaction, "deadline")}に予約して`,
      "operator-cancel-schedule": `大会ID「${tournamentId}」の第${round}回戦の受付終了予約を取り消して`,
    };
    return runAgentInteraction(interaction, actor, prompts[form] ?? "入力内容を処理して", undefined);
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
