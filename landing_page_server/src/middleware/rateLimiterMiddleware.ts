import { MiddlewareHandler } from 'hono';
import { Env, TenantInfo } from '../types';
import { getTenantInfo } from './utils';

// In-memory cache for the current Worker instance. Not globally consistent.
const memoryCache: Map<string, number> = new Map();
const BATCH_SIZE = 100; // Write to KV every 100 requests.

export const rateLimiterMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const tenantInfo = getTenantInfo(c.req.url);
  const tenantId = tenantInfo.siteName; // Use a unique ID for the tenant site

  // 1. Check if this tenant is already being monitored by the DO
  const status = await c.env.USAGE_LIMIT.get(`status:${tenantId}`);
  if (status === 'monitoring') {
    const doId = c.env.RATE_LIMITER_DO.idFromName(tenantId);
    const stub = c.env.RATE_LIMITER_DO.get(doId);
    // Forward the request to the DO for precise handling and stop middleware execution
    return stub.fetch(c.req.raw);
  }

  // --- Fast Path using in-memory cache and batched KV writes ---
  let currentInMemoryCount = memoryCache.get(tenantId) || 0;
  currentInMemoryCount++;
  memoryCache.set(tenantId, currentInMemoryCount);

  // 2. Batch write to KV to save on costs and improve performance
  if (currentInMemoryCount % BATCH_SIZE === 0) {
    const totalCount = await c.env.USAGE_LIMIT.get<number>(`count:${tenantId}`, { type: 'json' }) || 0;
    const newTotal = totalCount + BATCH_SIZE;

    // Use c.executionCtx to run these non-blocking operations after the response is sent
    c.executionCtx.waitUntil(c.env.USAGE_LIMIT.put(`count:${tenantId}`, JSON.stringify(newTotal)));

    const monitoringThreshold = c.env.USAGE_LIMIT * c.env.MONITORING_THRESHOLD_PERCENT;

    // 3. Check if we've crossed the monitoring threshold
    if (newTotal > monitoringThreshold) {
      console.log(`Tenant ${tenantId} crossed threshold. Activating DO monitoring.`);
      c.executionCtx.waitUntil(c.env.USAGE_LIMIT.put(`status:${tenantId}`, 'monitoring'));
    }
  }

  // If we're on the fast path and under the threshold, continue to the next middleware (asset serving)
  await next();
};
