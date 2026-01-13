import { Redis } from "ioredis";
import { env } from "@core";
import { randomUUID } from "crypto";

/**
 * Redis-based distributed lock for preventing concurrent access to resources.
 * Uses SET NX PX pattern for atomic lock acquisition with automatic expiry.
 */
export class RedisLock {
  private static client: Redis | null = null;
  private static readonly DEFAULT_TTL_MS = 30000; // 30 seconds
  private static readonly RETRY_DELAY_MS = 50;
  private static readonly MAX_RETRIES = 100; // 5 seconds total wait time

  private static getClient(): Redis {
    if (!this.client) {
      this.client = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
    }
    return this.client;
  }

  /**
   * Acquire a distributed lock.
   * @param key - The lock key
   * @param ttlMs - Time-to-live in milliseconds (auto-releases after this time)
   * @returns Lock token if acquired, null if failed
   */
  static async acquire(key: string, ttlMs: number = this.DEFAULT_TTL_MS): Promise<string | null> {
    const client = this.getClient();
    const token = randomUUID();
    const lockKey = `lock:${key}`;

    // SET key value NX PX milliseconds
    // NX = only set if not exists
    // PX = expire after milliseconds
    const result = await client.set(lockKey, token, "PX", ttlMs, "NX");

    return result === "OK" ? token : null;
  }

  /**
   * Release a distributed lock.
   * Only releases if the token matches (prevents releasing someone else's lock).
   * @param key - The lock key
   * @param token - The token returned from acquire()
   */
  static async release(key: string, token: string): Promise<boolean> {
    const client = this.getClient();
    const lockKey = `lock:${key}`;

    // Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await client.eval(script, 1, lockKey, token);
    return result === 1;
  }

  /**
   * Acquire lock with retry logic.
   * @param key - The lock key
   * @param ttlMs - Time-to-live in milliseconds
   * @param maxRetries - Maximum number of retries
   * @param retryDelayMs - Delay between retries in milliseconds
   */
  static async acquireWithRetry(
    key: string,
    ttlMs: number = this.DEFAULT_TTL_MS,
    maxRetries: number = this.MAX_RETRIES,
    retryDelayMs: number = this.RETRY_DELAY_MS
  ): Promise<string | null> {
    for (let i = 0; i < maxRetries; i++) {
      const token = await this.acquire(key, ttlMs);
      if (token) {
        return token;
      }
      await this.sleep(retryDelayMs);
    }
    return null;
  }

  /**
   * Execute a function while holding a lock.
   * Automatically acquires and releases the lock.
   * @param key - The lock key
   * @param fn - Function to execute while holding the lock
   * @param ttlMs - Time-to-live in milliseconds
   */
  static async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    ttlMs: number = this.DEFAULT_TTL_MS
  ): Promise<T> {
    const token = await this.acquireWithRetry(key, ttlMs);

    if (!token) {
      throw new Error(`Failed to acquire lock for key: ${key}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(key, token);
    }
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Close the Redis connection (for cleanup in tests).
   */
  static async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}
