import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse } from "dotenv";
import { spawnServer } from "@langchain/langgraph-api";

// If we can add postgres capability to the raw Langgraph API, we can use this server
const configPath = fileURLToPath(new URL("./langgraph.auth.json", import.meta.url));
const config = JSON.parse(await readFile(configPath, "utf-8"));

let env = {} as NodeJS.ProcessEnv;
if (typeof config.env === "string") {
  const targetEnvFile = resolve(dirname(configPath), config.env);
  env = parse(await readFile(targetEnvFile, "utf-8")) as NodeJS.ProcessEnv;
} else if (config.env != null) {
  env = config.env;
}

await spawnServer(
  { port: "2024", nJobsPerWorker: "10", host: "localhost" },
  { config, env, hostUrl: "https://smith.langchain.com" },
  { pid: process.pid, projectCwd: dirname(configPath) },
);
