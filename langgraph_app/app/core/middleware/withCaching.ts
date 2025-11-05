import { cache } from "@core";
import { env } from "@app";
import { shasum } from "@ext";
import { isHumanMessage } from "@types";
import type { BaseMessage } from "@langchain/core/messages";
import type { NodeFunction } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

type KeyFunc = (...args: unknown[]) => string;

const keyFunc: KeyFunc = (...args: unknown[]): string => {
    const params = args[0] as Record<string, unknown> || {} as { messages: BaseMessage[] };
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

type WithCachingConfig = {
    keyFunc?: KeyFunc;
    ttl?: number;
}

class NodeCacheFactory {
    async save(prefix: string, cacheKey: string, result: any, ttl: number) {
        if (!cache) return;

        await cache.set([{
            key: [[prefix], cacheKey],
            value: result,
            ttl
        }]);
    }

    async load(prefix: string, cacheKey: string) {
        if (!cache) return;
        
        const results = await cache.get([[[prefix], cacheKey]]);
        if (results.length > 0 && results[0]) {
            return results[0].value;
        }
        return undefined;
    }
}

const NodeCache = new NodeCacheFactory();

/**
 * Wraps a node function with context that includes node name and graph name
 * The graph name is automatically extracted from config.configurable (thread_id or checkpoint_ns)
 */
export const withCaching = <TState extends Record<string, unknown>>(
    nodeFunction: NodeFunction<TState>,
    options: WithCachingConfig
): NodeFunction<TState> => {
    return async (state: TState, config: LangGraphRunnableConfig) => {
        if (env.USE_CACHE !== true) {
            return nodeFunction(state, config);
        }
        const prefix = `node-${env.NODE_ENV}`;

        const cacheKey = options.keyFunc?.([state]) || keyFunc([state]);
        const cachedResult = await NodeCache.load(prefix, cacheKey);

        if (cachedResult !== undefined) {
            return cachedResult as Partial<TState>;
        }

        const result = await nodeFunction(state, config);
        await NodeCache.save(prefix, cacheKey, result, options.ttl || 60 * 60 * 24);
        return result;
    }
}