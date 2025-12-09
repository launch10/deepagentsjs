import { env } from "../env";
import { RedisCache } from "@ext";

const redisUrl = env.REDIS_URL;

if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

export const cache = new RedisCache(redisUrl);
