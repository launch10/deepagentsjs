import { CacheMiddleware } from './cache-middleware';
// import { IconMiddleware } from './icon-middleware';

export const MiddlewareChain = (env: Env) => [
    CacheMiddleware(env),
    // IconMiddleware(env)
]