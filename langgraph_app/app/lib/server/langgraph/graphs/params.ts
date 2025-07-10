import { RedisCache } from "@ext/redisCache";

const useCache = (process.env.USE_CACHE === 'true');
const redisUrl = process.env.REDIS_URI_CUSTOM;
let cache: RedisCache | undefined;
if (useCache && redisUrl) {
    cache = new RedisCache(redisUrl);
}

export const graphParams = useCache ? { cache } : {};