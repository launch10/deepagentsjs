import { cache } from "../../cache";
import { env } from "../../env";
import { shasum } from "@ext";
import type { BaseMessage } from "@langchain/core/messages";

export { keyFunc };

const keyFunc = (args: unknown[]): string => {
    const params = args[0] as Record<string, unknown> || {} as { messages: BaseMessage[] };
    const messages = params.messages as BaseMessage[] || [];
    const humanMessages = messages.filter((m: BaseMessage) => m.getType() === "human");
    
    if (humanMessages.length === 0) {
        return 'no-messages';
    }
    
    const messageContent = humanMessages.map((m: BaseMessage, idx: number) => 
        `${idx}:${m.content}`
    ).join('|');
    
    const hash = shasum(messageContent).substring(0, 12);
    
    const lastMessage = humanMessages[humanMessages.length - 1];
    const preview = String(lastMessage.content)
        .substring(0, 30)
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase();
    
    return `${hash}-${preview}`;
}

export interface CacheOptions {
    prefix: string;
    keyFunc?: (args: unknown[]) => string;
    ttl: number;
}

const defaultCacheOptions: CacheOptions = {
    prefix: process.env.NODE_ENV || "development",
    keyFunc: keyFunc,
    ttl: 60 * 60 * 24
}

const cacheResults = async (
    prefix: string, 
    cacheKey: string, 
    result: any, 
    ttl: number
): Promise<void> => {
    if (!cache) return;
    
    await cache.set([{
        key: [[prefix], cacheKey],
        value: result,
        ttl
    }]);
}

const loadCachedResults = async (
    prefix: string, 
    cacheKey: string
): Promise<any | undefined> => {
    if (!cache) return;
    
    const results = await cache.get([[[prefix], cacheKey]]);
    if (results.length > 0 && results[0]) {
        return results[0].value;
    }
    return undefined;
}

export function withCaching(options: CacheOptions = defaultCacheOptions) {
    // Ensure we have a keyFunc
    const finalOptions = {
        ...defaultCacheOptions,
        ...options,
        keyFunc: options.keyFunc || keyFunc
    };
    
    return function (target: any, propertyKey: string, descriptor?: PropertyDescriptor): PropertyDescriptor {
        if (!descriptor) {
            descriptor = Object.getOwnPropertyDescriptor(target, propertyKey) || {
                value: target[propertyKey],
                writable: true,
                enumerable: false,
                configurable: true
            };
        }
        
        const originalMethod = descriptor.value;
        
        descriptor.value = async function (this: any, ...args: any[]): Promise<any> {
            const boundMethod = originalMethod.bind(this);

            if (env.USE_CACHE !== 'true') {
                return await boundMethod(...args);
            }
            console.log(`i am using cache because i ma not`)
            
            const cacheKey = finalOptions.keyFunc(args);
            const cachedResult = await loadCachedResults(finalOptions.prefix, cacheKey);

            if (cachedResult !== undefined) {
                return cachedResult;
            }
            
            const result = await boundMethod(...args);
            await cacheResults(finalOptions.prefix, cacheKey, result, finalOptions.ttl);
            return result;
        };
        
        return descriptor;
    };
}