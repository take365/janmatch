const origin = process.env.JANMATCH_APP_ORIGIN || "http://localhost:3000";
const response = await fetch(new URL("/api/tournaments/notifications", origin), { headers: { "x-janmatch-local-check": "1" } });
const body = await response.text();
console.log(`notification check: HTTP ${response.status} ${body}`);
if (!response.ok) process.exitCode = 1;
