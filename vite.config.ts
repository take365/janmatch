import vinext from "vinext";
import { defineConfig } from "vite";
import hostingConfig from "./.openai/hosting.json";
const { d1 } = hostingConfig;
export default defineConfig(async () => { const { cloudflare } = await import("@cloudflare/vite-plugin"); return { server: { allowedHosts: true }, plugins: [vinext(), cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"], }, config: { main: "./worker/index.ts", d1_databases: [{ binding: d1 || "DB", database_name: "janmatch-local", database_id: "00000000-0000-4000-8000-000000000000", migrations_dir: "drizzle" }] } })] }; });
