import { Redis } from "ioredis";
import { env } from "@core";

export const createRedisConnection = () => {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  connection.config("SET", "maxmemory-policy", "noeviction").catch((err) => {
    console.error("Failed to set Redis eviction policy:", err);
  });

  return connection;
};

export const queueConnection = createRedisConnection();
