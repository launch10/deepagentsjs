import { Pool } from "pg";
import { env } from "./env";

export const pool: Pool = (() => {
    const postgresUri = env.POSTGRES_URI;

    if (!postgresUri) {
        throw new Error("POSTGRES_URI is not set");
    }
    
    return new Pool({
        connectionString: postgresUri,
        max: 10, // Set reasonable max connections
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });
})()

export async function cleanupPool(): Promise<void> {
    if (!pool) {
        throw new Error("Pool is not initialized");
    }

    await pool.end();
}