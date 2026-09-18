import handler from "vinext/server/app-router-entry";
export default {
  fetch: (request: Request, env: unknown, ctx: ExecutionContext) => handler.fetch(request, env, ctx),
  async scheduled(controller: ScheduledController, env: unknown, ctx: ExecutionContext) {
    const values = env as Record<string, unknown>;
    const secret = typeof values.DISCORD_CRON_SECRET === "string" ? values.DISCORD_CRON_SECRET : "";
    if (!secret) { console.warn("DISCORD_CRON_SECRET未設定のため定時通知を確認できません"); return; }
    const request = new Request("http://internal/api/tournaments/notifications", { headers: { "x-janmatch-cron": secret } });
    await handler.fetch(request, env, ctx);
    void controller;
  },
};
