import { env } from "@app";
import { shasum } from "@ext";
import { getNodeContext } from "./withContext";
import { isHumanMessage } from "@types";
import type { BaseMessage } from "@langchain/core/messages";
import type { NodeFunction, MinimalGraphState } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeCache } from "@core";

type KeyFunc<TState = any> = (state: TState) => string;

const defaultKeyFunc: KeyFunc = (state: MinimalGraphState): string => {
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

/**
 * Wraps a node function with context that includes node name and graph name
 * The graph name is automatically extracted from config.configurable (thread_id or checkpoint_ns)
 */
export const withCaching = <TState extends MinimalGraphState>(
    nodeFunction: NodeFunction<TState>,
    options: WithCachingConfig<TState> = {}
): NodeFunction<TState> => {
    return async (state: TState, config: LangGraphRunnableConfig) => {
        if (env.USE_CACHE !== true) {
            return nodeFunction(state, config);
        }

        const nodeName = getNodeContext()?.name;
        const cacheKeyBase = options.keyFunc?.(state) || defaultKeyFunc(state);
        const cacheKey = `${nodeName}-${cacheKeyBase}`;
        const cachedResult = await NodeCache.load(cacheKey);

        if (cachedResult !== undefined) {
            return cachedResult as Partial<TState>;
        }

        const result = await nodeFunction(state, config);
        await NodeCache.save(cacheKey, result, options.ttl);
        return result;
    }
}