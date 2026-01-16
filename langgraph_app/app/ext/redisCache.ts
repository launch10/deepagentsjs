import { Redis } from "ioredis";
import { JsonPlusSerializer } from "./serde/jsonplus";

export class RedisCache<V = unknown> {
  private readonly client: Redis;
  serde = new JsonPlusSerializer();

  constructor(redisUrl: string) {
    if (!redisUrl) {
      throw new Error(
        "Redis connection URI not found. Please set the REDIS_URL environment variable."
      );
    }
    this.client = new Redis(redisUrl);
  }

  async get(keys: string[]): Promise<{ key: string; value: V }[]> {
    if (!keys.length) return [];

    const foundValues: { key: string; value: V }[] = [];

    for (const key of keys) {
      try {
        const cached = await this.client.hgetall(key);

        if (cached && cached.enc && cached.val) {
          try {
            let valData: Uint8Array | string;
            if (cached.enc === "json" && typeof cached.val === "string") {
              valData = new Uint8Array(Buffer.from(cached.val, "base64"));
            } else {
              valData = cached.val;
            }

            const value = await this.serde.loadsTyped(cached.enc, valData);
            foundValues.push({ key, value });
          } catch (e) {
            console.error(`Failed to deserialize value for key ${key}:`, e);
          }
        }
      } catch (error) {
        console.error(`Error fetching key ${key} from Redis:`, error);
      }
    }

    return foundValues;
  }

  async set(pairs: { key: string; value: V; ttl?: number }[]): Promise<void> {
    if (!pairs.length) return;

    for (const { key, value, ttl } of pairs) {
      try {
        const [enc, val] = await this.serde.dumpsTyped(value);
        const valStr = val instanceof Uint8Array ? Buffer.from(val).toString("base64") : val;
        await this.client.hset(key, { enc, val: valStr });

        if (ttl != null && ttl > 0) {
          await this.client.expire(key, ttl);
        }
      } catch (error) {
        console.error(`Error setting key ${key} in Redis:`, error);
      }
    }
  }

  async query(pattern: string = "*"): Promise<string[]> {
    const keys: string[] = [];

    const stream = this.client.scanStream({
      match: pattern,
      count: 100,
    });

    return new Promise((resolve, reject) => {
      stream.on("data", (batch) => {
        keys.push(...batch);
      });

      stream.on("end", () => {
        resolve(keys);
      });

      stream.on("error", (err) => {
        reject(err);
      });
    });
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      await this.client.flushdb();
      return;
    }

    const stream = this.client.scanStream({
      match: pattern,
      count: 100,
    });

    let keysToDelete: string[] = [];
    stream.on("data", (keys) => {
      keysToDelete.push(...keys);
      if (keysToDelete.length >= 500) {
        this.client.del(keysToDelete);
        keysToDelete = [];
      }
    });

    await new Promise<void>((resolve, reject) => {
      stream.on("end", async () => {
        if (keysToDelete.length > 0) {
          await this.client.del(keysToDelete);
        }
        resolve();
      });
      stream.on("error", (err) => {
        reject(err);
      });
    });
  }

  async flushdb(): Promise<void> {
    await this.client.flushdb();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  async keys(pattern: string = "*"): Promise<string[]> {
    return this.client.keys(pattern);
  }

  /**
   * Fetch a value from cache, or compute and store it if not present.
   * Follows the Rails cache.fetch pattern.
   *
   * @param key - Cache key
   * @param compute - Function to compute the value if not cached
   * @param ttl - Time to live in seconds (optional)
   * @returns The cached or computed value
   */
  async fetch<T>(key: string, compute: () => Promise<T>, ttl?: number): Promise<T> {
    // Try to get from cache first
    const cached = await this.get([key]);
    if (cached.length > 0 && cached[0]) {
      return cached[0].value as unknown as T;
    }

    // Compute the value
    const value = await compute();

    // Store in cache
    await this.set([{ key, value: value as unknown as V, ttl }]);

    return value;
  }

  /**
   * Delete a specific key from cache
   */
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
