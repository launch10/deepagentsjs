import { cache } from "@core";
import { env } from "@app";
import { shasum } from "@ext";
import { isHumanMessage } from "@types";
import type { BaseMessage } from "@langchain/core/messages";
import type { NodeFunction } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

type KeyFunc<TState = any> = (state: TState) => string;

const defaultKeyFunc: KeyFunc = (state: Record<string, unknown>): string => {
    const params = state || {} as { messages: BaseMessage[] };
    const messages = params.messages as BaseMessage[] || [];
    const humanMessages = messages.filter(isHumanMessage);
    const lastMessage = humanMessages.at(-1);
    
    if (!lastMessage) {
        return 'no-messages';
    }
    
    const messageContent = humanMessages.map((m: BaseMessage, idx: number) => 
        `${idx}:${m.content}`
    ).join('|');
    
    const hash = shasum(messageContent).substring(0, 12);
    
    const preview = String(lastMessage.content)
        .substring(0, 30)
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();
    
    return `${hash}-${preview}`;
}

type WithCachingConfig<TState = any> = {
    keyFunc?: KeyFunc<TState>;
    ttl?: number;
}

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

/**
 * Wraps a node function with context that includes node name and graph name
 * The graph name is automatically extracted from config.configurable (thread_id or checkpoint_ns)
 */
export const withCaching = <TState extends Record<string, unknown>>(
    nodeFunction: NodeFunction<TState>,
    options: WithCachingConfig<TState> = {}
): NodeFunction<TState> => {
    return async (state: TState, config: LangGraphRunnableConfig) => {
        if (env.USE_CACHE !== true) {
            return nodeFunction(state, config);
        }

        const cacheKey = options.keyFunc?.(state) || defaultKeyFunc(state);
        const cachedResult = await NodeCache.load(cacheKey);

        if (cachedResult !== undefined) {
            return cachedResult as Partial<TState>;
        }

        const result = await nodeFunction(state, config);
        await NodeCache.save(cacheKey, result, options.ttl);
        return result;
    }
}