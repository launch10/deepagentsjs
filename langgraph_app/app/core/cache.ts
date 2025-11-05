import { env } from "./env";
import { RedisCache } from "@ext";

const redisUrl = env.REDIS_URI;

if (!redisUrl) {
    throw new Error('REDIS_URI is not set');
}

export const cache = new RedisCache(redisUrl);