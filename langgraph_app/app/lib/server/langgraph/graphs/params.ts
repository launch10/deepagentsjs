import { RedisCache } from "@ext/redisCache";

const useCache = (process.env.USE_CACHE === 'true');
const redisUrl = process.env.REDIS_URI;
let cache: RedisCache | undefined;

if (useCache && redisUrl) {
    cache = new RedisCache(redisUrl);
} else {
    Array.from({length: 5}).forEach(() => 
        console.log(`[WARNING]: Not using Redis cache! Nodes will not be cached.`)
    );
}

export const graphParams = useCache ? { cache } : {};