import { Redis } from "ioredis";
import { env, getLogger } from "@core";

const log = getLogger({ component: "RedisConnection" });

export const createRedisConnection = () => {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  connection.config("SET", "maxmemory-policy", "noeviction").catch((err) => {
    log.error({ err }, "Failed to set Redis eviction policy");
  });

  return connection;
};

export const queueConnection = createRedisConnection();
