import { existsSync, readFileSync } from "node:fs";

if (existsSync(".dev.vars")) {
  for (const line of readFileSync(".dev.vars", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2];
  }
}

const applicationId = process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;
if (!applicationId || !guildId || !botToken) throw new Error("DISCORD_APPLICATION_ID(or CLIENT_ID), DISCORD_GUILD_ID, DISCORD_BOT_TOKEN が必要です");
const commands = [{ name: "janmatch", description: "JanMatch運営アシスタントAIに依頼します", options: [{ type: 3, name: "content", description: "依頼内容", required: true }] }, { name: "aiに依頼", type: 3 }];
const response = await fetch(`https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`, { method: "PUT", headers: { authorization: `Bot ${botToken}`, "content-type": "application/json" }, body: JSON.stringify(commands) });
if (!response.ok) throw new Error(`Discordコマンド登録に失敗しました: HTTP ${response.status}`);
console.log(`Discord Guildコマンドを${commands.length}件登録しました。`);
