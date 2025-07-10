import { Redis } from "ioredis";
import { BaseCache, type SerializerProtocol } from "@langchain/langgraph-checkpoint";
import { JsonPlusSerializer } from "./serde/jsonplus";

export type CacheNamespace = string[];
export type CacheFullKey = [namespace: CacheNamespace, key: string];

/**
 * A cache implementation that stores data in a Redis server.
 *
 * This class provides a Redis-based alternative to the InMemoryCache,
 * offering persistence, scalability, and shared state across multiple processes.
 * It uses efficient Redis commands and patterns like Hashes, Pipelines, and SCAN
 * to ensure high performance.
 */
export class RedisCache<V = unknown> extends BaseCache<V> {
  private readonly client: Redis;
  serde: SerializerProtocol = new JsonPlusSerializer();

  constructor(redisUrl: string) {
    super();
    if (!redisUrl) {
      throw new Error(
        "Redis connection URI not found. Please set the REDIS_URI_CUSTOM environment variable."
      );
    }
    this.client = new Redis(redisUrl);
  }

  private getRedisKey(fullKey: CacheFullKey): string {
    const [namespace, key] = fullKey;
    const strNamespace = namespace.join(",");
    // Use a colon as a separator for better readability and namespacing in Redis.
    return `${strNamespace}:${key}`;
  }

  /**
   * Retrieves multiple cache entries from Redis.
   * @param keys An array of `CacheFullKey`s to retrieve.
   * @returns A promise that resolves to an array of found key-value pairs.
   *   Items not found in the cache are omitted from the result.
   */
  async get(keys: CacheFullKey[]): Promise<{ key: CacheFullKey; value: V }[]> {
    if (!keys.length) return [];

    const foundValues: { key: CacheFullKey; value: V }[] = [];

    for (const fullKey of keys) {
      try {
        const redisKey = this.getRedisKey(fullKey);
        const cached = await this.client.hgetall(redisKey);

        // HGETALL on a non-existent key returns an empty object
        if (cached && cached.enc && cached.val) {
          try {
            const value = await this.serde.loadsTyped(cached.enc, cached.val);
            foundValues.push({ key: fullKey, value });
          } catch (e) {
            console.error(`Failed to deserialize value for key ${redisKey}:`, e);
            console.error(`Cached data - enc: ${cached.enc}, val: ${typeof cached.val === 'string' ? cached.val.substring(0, 100) + '...' : cached.val}`);
          }
        }
      } catch (error) {
        console.error(`Error fetching key ${this.getRedisKey(fullKey)} from Redis:`, error);
      }
    }

    return foundValues;
  }

  /**
   * Stores multiple key-value pairs in Redis.
   * @param pairs An array of objects containing the key, value, and optional TTL to set.
   */
  async set(
    pairs: { key: CacheFullKey; value: V; ttl?: number }[]
  ): Promise<void> {
    if (!pairs.length) return;

    for (const { key: fullKey, value, ttl } of pairs) {
      try {
        const redisKey = this.getRedisKey(fullKey);
        const [enc, val] = await this.serde.dumpsTyped(value);

        // Store the encoding type and the value in a Redis Hash
        await this.client.hset(redisKey, { enc, val });

        // Set expiration if provided
        if (ttl != null && ttl > 0) {
          await this.client.expire(redisKey, ttl);
        }
      } catch (error) {
        console.error(`Error setting key ${this.getRedisKey(fullKey)} in Redis:`, error);
      }
    }
  }

  /**
   * Deletes all keys within the given namespaces. If no namespaces are provided,
   * it clears the entire database.
   * @param namespaces An array of namespaces to clear. If empty, the entire
   *   current Redis database will be flushed (a destructive operation).
   */
  async clear(namespaces: CacheNamespace[]): Promise<void> {
    if (!namespaces.length) {
      // DANGER: This clears the entire currently selected Redis database.
      // This is the direct equivalent of `this.cache = {}` from InMemoryCache.
      // Use with extreme caution in a shared Redis instance.
      console.warn("Clearing all keys from the current Redis database (FLUSHDB).");
      await this.client.flushdb();
      return;
    }

    for (const namespace of namespaces) {
      const strNamespace = namespace.join(",");
      // Pattern to match all keys that start with the given namespace string.
      const pattern = `${strNamespace}:*`;

      // Use SCAN to safely iterate over keys without blocking the server.
      const stream = this.client.scanStream({
        match: pattern,
        count: 100, // Fetch 100 keys per iteration for efficiency.
      });

      // Collect all keys from the stream and delete them in batches.
      let keysToDelete: string[] = [];
      stream.on("data", (keys) => {
        keysToDelete.push(...keys);
        // To avoid holding too many keys in memory, delete in chunks.
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
  }

  /**
   * Gracefully disconnects from the Redis server.
   * It's good practice to call this before your application exits.
   */
  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}