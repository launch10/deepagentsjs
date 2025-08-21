import { Context, MiddlewareHandler, Next } from 'hono';
import { usageThresholdPercent, Env, UserType, WebsiteType, FirewallType } from '~/types';
import { scopedLogger } from './utils';
import { MemoryCache } from './memoryCache';
import { User, Website, Firewall, Request, Plan } from '~/models';
import { v4 as uuidv4 } from 'uuid';

// Each website might have 10 requests (e.g. images, css, js, etc.)
// So this is closer to "10 page views" than "100 page views"
const BATCH_SIZE = 10;
class RateLimiter {
    private batchSize: number;
    private memoryCache: MemoryCache;
    
    constructor() {
        this.memoryCache = new MemoryCache();
        this.batchSize = BATCH_SIZE;
    }

    isDocumentRequest = (url: string): boolean => {
        const path = new URL(url).pathname;
        return path.endsWith('/') || path.endsWith('.html') || path.endsWith('.htm');
    };
    
    async fetch(c: Context<{ Bindings: Env }>, next: Next) {
      if (!this.isDocumentRequest(c.req.url)) return next();

      const websiteModel = new Website(c);
      const website = await websiteModel.findByUrl(c.req.url);

      if (!website) {
        throw new Error(`Website not found for URL: ${c.req.url}`);
      }

      const userId = website.userId;
      const userModel = new User(c);
      const user = await userModel.get(userId);

      if (!user) {
        throw new Error(`User not found for ID: ${userId}`);
      }

      const firewallModel = new Firewall(c);
      const firewall = await firewallModel.findByUser(userId);
      const status = firewall ? firewall.status : 'inactive';
      let shouldBlock;

      if (status === 'monitoring') {
        shouldBlock = await firewallModel.shouldBlock(user);
      } else { 
        shouldBlock = status === 'blocked';
      }

      if (shouldBlock) {
        scopedLogger.debug(`rateLimiting!`);
        await firewallModel.block(user);
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }

      await this.updateRequestCount(c, user);
      return next();
    }

    private async updateRequestCount(c: Context<{ Bindings: Env }>, user: UserType): Promise<void> {
      let currentCount = this.memoryCache.incrementRequestCount(c, user.id);

      scopedLogger.debug(`currentCount: ${currentCount}`);

      if (currentCount % this.batchSize === 0) {
        scopedLogger.debug(`writing to KV for ${c.req.url}`);
        const requestModel = new Request(c);
        const requests = await requestModel.findByUserId(user.id);
        const newTotal = (requests?.count || 0) + currentCount;
        
        if (requests) {
            await requestModel.set(requests.id, {...requests, count: newTotal});
        } else {
            const newRequest = { count: newTotal, userId: String(user.id), id: uuidv4() };
            await requestModel.set(newRequest.id, newRequest);
        }
        this.memoryCache.resetRequestCount(c, user.id);

        if (await this.didCrossThreshold(c, user, newTotal)) {
          await this.afterThresholdCrossed(c, user);
        }
      }
    }

    private async didCrossThreshold(c: Context<{ Bindings: Env }>, user: UserType, newTotal: number): Promise<boolean> {
      const planModel = new Plan(c);
      const plan = await planModel.get(user.planId);

      if (!plan) {
        throw new Error(`Plan not found for ID: ${user.planId}`);
      }

      const usersLimit = planModel.getMonthlyLimit(plan);
      const monitoringThreshold = usersLimit * usageThresholdPercent;

      return newTotal > monitoringThreshold;
    }

    private async afterThresholdCrossed(c: Context<{ Bindings: Env }>, user: UserType) {
      scopedLogger.debug(`User ${user.id} crossed threshold. Activating monitoring.`);
      const firewallModel = new Firewall(c);
      const existingFirewall = await firewallModel.findByUser(user.id);
      
      if (existingFirewall) {
        // Update existing firewall
        await firewallModel.set(existingFirewall.id, { ...existingFirewall, status: 'monitoring' });
      } else {
        // Create new firewall
        const newFirewall = { id: uuidv4(), userId: String(user.id), status: 'monitoring' };
        await firewallModel.set(newFirewall.id, newFirewall);
      }
    }
}

const rateLimiter = new RateLimiter();

export const rateLimiterMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  return rateLimiter.fetch(c, next);
};
