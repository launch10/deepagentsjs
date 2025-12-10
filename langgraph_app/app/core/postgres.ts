import { Pool } from "pg";
import { env } from "./env";

export const pool: Pool = (() => {
  const postgresUri = env.DATABASE_URL;

  if (!postgresUri) {
    throw new Error("DATABASE_URL is not set");
  }

  const newPool = new Pool({
    connectionString: postgresUri,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  newPool.on("error", (err) => {
    console.error("Unexpected pool error:", err);
  });

  return newPool;
})();

export async function cleanupPool(): Promise<void> {
  if (!pool) {
    throw new Error("Pool is not initialized");
  }

  await pool.end();
}
