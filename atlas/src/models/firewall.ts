import { Context } from "hono";
import { Env, FirewallType, UserType, WebsiteType, FirewallRuleType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";
import { FirewallRule } from "./firewallRule";
import { Request as RequestModel } from "./request";
import { Website } from "./website";
import { Plan } from "./plan";
import { v4 as uuidv4 } from 'uuid';
import { updateFirewallList, removeFromFirewallList } from '~/utils/cloudflareApi';

const isFirewallType = createTypeGuard<FirewallType>(
    (data: any): data is FirewallType => {
        return data.id !== undefined &&
            data.userId !== undefined &&
            data.status !== undefined;
    }
);

export class FirewallDO implements DurableObject {
  state: DurableObjectState;
  env: Env;
  count: number = 0;
  userId: string | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Initialize count from storage
    this.state.blockConcurrencyWhile(async () => {
      this.count = await this.state.storage.get<number>('count') || 0;
      this.userId = await this.state.storage.get<string>('userId') || null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle firewall check requests
    if (url.pathname === '/check-firewall' && request.method === 'POST') {
      try {
        const data = await request.json() as {
          userId: string;
          requestCount: number;
          planLimit: number;
          websiteUrl: string;
          timestamp: number;
        };
        
        // If this is the first request for this user, initialize count
        if (this.count === 0) {
          this.count = data.requestCount;
          await this.state.storage.put('count', this.count);
          await this.state.storage.put('userId', data.userId);
        } else {
          // Increment the count
          this.count++;
          await this.state.storage.put('count', this.count);
        }
        
        // Check if we should block
        const shouldBlock = this.count > data.planLimit;
        
        return new Response(JSON.stringify({ shouldBlock }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        // If we break this code, it could have catastrophic consequences,
        // so we should err on the side of caution and block the website
        return new Response(JSON.stringify({ shouldBlock: true }), {
          headers: { 'Content-Type': 'application/json' },
          status: 500
        });
      }
    }
    
    // Default response for other requests
    return new Response('Not Found', { status: 404 });
  }
}
export class Firewall extends BaseModel<FirewallType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'firewall', isFirewallType);
    }

    protected defineIndexes(): void {
        this.addIndex({
            name: 'userId',
            keyExtractor: (firewall) => firewall.userId ? String(firewall.userId) : null,
            type: 'unique'
        });

        this.addIndex({
            name: 'status',
            keyExtractor: (firewall) => firewall.status || null,
            type: 'list'
        });
    }

    async block(user: UserType): Promise<FirewallRuleType[]> {
      const websiteModel = new Website(this.c);
      const usersWebsites: WebsiteType[] = await websiteModel.findByUser(user.id);
      const firewallRuleModel = new FirewallRule(this.c);
      const existingRules = await firewallRuleModel.findByUser(user.id);
      const existingRulesByUrl = existingRules.reduce((acc, rule) => {
        acc[rule.url] = rule;
        return acc;
      }, {} as Record<string, FirewallRuleType>);
      const blockedUrls = existingRules.filter(rule => rule.status === 'blocked').map(rule => rule.url)
      const urlsToBlock = usersWebsites.map(website => website.url).filter(url => !blockedUrls.includes(url));

      if (urlsToBlock.length > 0) {
        const [didBlock, cloudflareIds] = await updateFirewallList(this.c.env, urlsToBlock);

        if (!didBlock) {
          throw new Error('Failed to update Firewall List');
        }
        
        const promises = urlsToBlock.filter((url) => cloudflareIds[url]).map((url) => {
          let rule = existingRulesByUrl[url] || {
            id: uuidv4(),
            url: url,
            userId: user.id,
            status: 'blocked'
          };
          rule = { ...rule, cloudflareId: cloudflareIds[url], status: 'blocked' };
          return firewallRuleModel.set(rule.id, rule);
        })
        await Promise.all(promises);
      }

      const existingFirewall = await this.findByUser(user.id);
      const firewall = existingFirewall || {
          id: uuidv4(),
          userId: String(user.id),
          status: 'blocked'
      };
      await this.set(firewall.id, { ...firewall, status: 'blocked' });

      const rules = await firewallRuleModel.findByUser(user.id);
      return rules.filter(rule => rule.status === 'blocked')
    }

    async unblock(user: UserType): Promise<FirewallRuleType[]> {
      const firewallRuleModel = new FirewallRule(this.c);
      const existingRules = await firewallRuleModel.findByUser(user.id);
      const existingRulesByUrl = existingRules.reduce((acc, rule) => {
        acc[rule.url] = rule;
        return acc;
      }, {} as Record<string, FirewallRuleType>);
      const rulesToUnblock = existingRules.filter(rule => rule.status === 'blocked')
      const blockCloudflareRuleIds = rulesToUnblock.map(rule => rule.cloudflareId).filter(id => id !== undefined) as string[];

      if (blockCloudflareRuleIds.length > 0) {
        const didRemove = await removeFromFirewallList(this.c.env, blockCloudflareRuleIds);

        if (!didRemove) {
          throw new Error('Failed to remove from Firewall List');
        }
      }

      const promises = rulesToUnblock.map(rule => {
        return firewallRuleModel.set(rule.id, { ...rule, status: 'inactive', cloudflareId: undefined });
      })
      await Promise.all(promises);

      const existingFirewall = await this.findByUser(user.id);
      const firewall = existingFirewall || {
          id: uuidv4(),
          userId: String(user.id),
          status: 'inactive'
      };
      await this.set(firewall.id, { ...firewall, status: 'inactive' });

      return rulesToUnblock;
    }

    async reset(user: UserType): Promise<void> {
      console.log(`about to reset ${user.id}`)
      await this.unblock(user);
      console.log(`did unblock... i think`)

      const requestModel = new RequestModel(this.c);
      const requests = await requestModel.findByUserId(user.id);
      if (requests) {
          await requestModel.set(requests.id, { count: 0 });
          console.log(`reset requests: ${JSON.stringify(requests)}`)
      }
    }

    async shouldBlock(user: UserType): Promise<boolean> {
      try {
          // Gather all necessary data before calling DurableObject
          const requestModel = new RequestModel(this.c);
          const planModel = new Plan(this.c);
          const websiteModel = new Website(this.c);
          
          const requests = await requestModel.findByUserId(user.id);
          const plan = await planModel.get(user.planId);
          const website = await websiteModel.findByUrl(this.c.req.url);
          
          if (!plan) {
              throw new Error(`Plan not found for ID: ${user.planId}`);
          }
          
          // Prepare data to send to DurableObject
          const requestData = {
            userId: user.id,
            requestCount: requests?.count || 0,
            planLimit: planModel.getMonthlyLimit(plan),
            websiteUrl: website?.url || this.c.req.url,
            timestamp: Date.now()
          };
          
          console.log('[Firewall.maybeActivate] Sending data to DurableObject:', requestData);
          
          // Communicate with DurableObject via fetch
          const doId = this.c.env.FIREWALL.idFromName(user.id);
          const durableObject = this.c.env.FIREWALL.get(doId);
          
          const response = await durableObject.fetch(
              new Request('http://internal/check-firewall', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(requestData)
              })
          );
          
          if (!response.ok) {
              console.error('[Firewall.maybeActivate] DurableObject response not ok:', response.status, await response.text());
              throw new Error(`DurableObject returned ${response.status}`);
          }
          
          const result = await response.json() as { shouldBlock: boolean };
          
          return result.shouldBlock;
      } catch (error) {
          console.error('[Firewall.maybeActivate] Error:', error);
          // On error, default to not blocking to avoid breaking the website
          return false;
      }
    }

    async findByUser(userId: string | number): Promise<FirewallType | null> {
      return this.findByIndex('userId', String(userId));
    }

    async findByStatus(status: string): Promise<FirewallType[]> {
      return this.findManyByIndex('status', status);
    }
}