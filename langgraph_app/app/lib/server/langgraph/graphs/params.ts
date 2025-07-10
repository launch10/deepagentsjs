import { Redis } from "ioredis";
import { RedisCache } from "@langchain/community/caches/ioredis";

const useCache = process.env.USE_CACHE === 'true';
let cache: RedisCache | undefined;
if (useCache) {
    const client = new Redis(process.env.REDIS_URI!);
    cache = new RedisCache(client);
}

export const graphParams = useCache ? { cache } : {};