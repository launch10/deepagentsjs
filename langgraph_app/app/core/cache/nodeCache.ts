import { env } from "@app";
import { cache } from "./redisCache";

class NodeCacheFactory {
    prefix: string;

    constructor() {
        this.prefix = `node:${env.NODE_ENV}`;
    }

    private getKey(cacheKey: string): string {
        return `${this.prefix}:${cacheKey}`;
    }

    async save(cacheKey: string, result: any, ttl?: number) {
        if (!cache) return;

        await cache.set([{
            key: this.getKey(cacheKey),
            value: result,
            ttl: ttl || 60 * 60 * 24
        }]);
    }

    async load(cacheKey: string) {
        if (!cache) return;
        
        const results = await cache.get([this.getKey(cacheKey)]);
        if (results.length > 0 && results[0]) {
            return results[0].value;
        }
        return undefined;
    }

    async list() {
        if (!cache) return;
        return await cache.query(`${this.prefix}:*`);
    }

    async clear() {
        if (!cache) return;
        await cache.clear(`${this.prefix}:*`);
    }

    async flushdb() {
        if (!cache) return;
        await cache.flushdb();
    }
}

export const NodeCache = new NodeCacheFactory();