import { Context } from "hono";
import { Env, FirewallType, TenantType, SiteType, FirewallRuleType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";
import { FirewallRule } from "./firewallRule";
import { Request as RequestModel } from "./request";
import { Site } from "./site";
import { Plan } from "./plan";

const isFirewallType = createTypeGuard<FirewallType>(
    (data: any): data is FirewallType => {
        return data.id !== undefined &&
            data.tenantId !== undefined &&
            data.status !== undefined;
    }
);

export class FirewallDO implements DurableObject {
  state: DurableObjectState;
  env: Env;
  count: number = 0;
  tenantId: string | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Initialize count from storage
    this.state.blockConcurrencyWhile(async () => {
      this.count = await this.state.storage.get<number>('count') || 0;
      this.tenantId = await this.state.storage.get<string>('tenantId') || null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle firewall check requests
    if (url.pathname === '/check-firewall' && request.method === 'POST') {
      try {
        const data = await request.json() as {
          tenantId: string;
          requestCount: number;
          planLimit: number;
          siteUrl: string;
          timestamp: number;
        };
        
        // If this is the first request for this tenant, initialize count
        if (this.count === 0) {
          this.count = data.requestCount;
          await this.state.storage.put('count', this.count);
          await this.state.storage.put('tenantId', data.tenantId);
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
        // so we should err on the side of caution and block the site
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
            name: 'tenantId',
            keyExtractor: (firewall) => firewall.tenantId || null,
            type: 'unique'
        });

        this.addIndex({
            name: 'status',
            keyExtractor: (firewall) => firewall.status || null,
            type: 'list'
        });
    }

    async block(tenant: TenantType): Promise<void> {
      const siteModel = new Site(this.c);
      const tenantsSites: SiteType[] = await siteModel.findByTenant(tenant.id);
      const firewallRuleModel = new FirewallRule(this.c);
      const existingRules = await firewallRuleModel.findByTenant(tenant.id);
      const existingRulesByUrl = existingRules.reduce((acc, rule) => {
        acc[rule.url] = rule;
        return acc;
      }, {} as Record<string, FirewallRuleType>);
      const unblockedUrls = existingRules.filter(rule => rule.status !== 'blocked').map(rule => rule.url)
      const urlsToBlock = tenantsSites.map(site => site.url).filter(url => !unblockedUrls.includes(url));

      const promises = urlsToBlock.map(url => {
        const existingRule = existingRulesByUrl[url];
        if (existingRule) {
          return firewallRuleModel.block({
            id: existingRule.id,
            url: url,
            tenantId: tenant.id,
          })
        }
        return firewallRuleModel.block({
          url: url,
          tenantId: tenant.id,
        })
      })
      await Promise.all(promises);

      const existingFirewall = await this.findByTenant(tenant.id);
      const firewall = existingFirewall || {
          id: tenant.id,
          tenantId: tenant.id,
          status: 'blocked'
      };
      await this.set(firewall.id, { ...firewall, status: 'blocked' });
    }

    async unblock(tenant: TenantType): Promise<void> {
      const firewallRuleModel = new FirewallRule(this.c);
      const existingRules = await firewallRuleModel.findByTenant(tenant.id);
      const existingRulesByUrl = existingRules.reduce((acc, rule) => {
        acc[rule.url] = rule;
        return acc;
      }, {} as Record<string, FirewallRuleType>);
      const blockedUrls = existingRules.filter(rule => rule.status === 'blocked').map(rule => rule.url)

      const promises = blockedUrls.map(url => {
        const existingRule = existingRulesByUrl[url];
        if (existingRule) {
          return firewallRuleModel.unblock({
            id: existingRule.id,
            url: url,
            tenantId: tenant.id,
          })
        }
      })
      await Promise.all(promises);

      const existingFirewall = await this.findByTenant(tenant.id);
      const firewall = existingFirewall || {
          id: tenant.id,
          tenantId: tenant.id,
          status: 'inactive'
      };
      await this.set(firewall.id, { ...firewall, status: 'inactive' });
    }

    async reset(tenant: TenantType): Promise<void> {
      console.log(`about to reset ${tenant.id}`)
      await this.unblock(tenant);
      console.log(`did unblock... i think`)

      const requestModel = new RequestModel(this.c);
      const requests = await requestModel.findByTenantId(tenant.id);
      if (requests) {
          await requestModel.set(requests.id, { count: 0 });
          console.log(`reset requests: ${JSON.stringify(requests)}`)
      }
    }

    async shouldBlock(tenant: TenantType): Promise<boolean> {
        try {
            // Gather all necessary data before calling DurableObject
            const requestModel = new RequestModel(this.c);
            const planModel = new Plan(this.c);
            const siteModel = new Site(this.c);
            
            const requests = await requestModel.findByTenantId(tenant.id);
            const plan = await planModel.get(tenant.planId);
            const site = await siteModel.findByUrl(this.c.req.url);
            
            if (!plan) {
                throw new Error(`Plan not found for ID: ${tenant.planId}`);
            }
            
            // Prepare data to send to DurableObject
            const requestData = {
              tenantId: tenant.id,
              requestCount: requests?.count || 0,
              planLimit: planModel.getMonthlyLimit(plan),
              siteUrl: site?.url || this.c.req.url,
              timestamp: Date.now()
            };
            
            console.log('[Firewall.maybeActivate] Sending data to DurableObject:', requestData);
            
            // Communicate with DurableObject via fetch
            const doId = this.c.env.FIREWALL.idFromName(tenant.id);
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
            // On error, default to not blocking to avoid breaking the site
            return false;
        }
    }

    async findByTenant(tenantId: string): Promise<FirewallType | null> {
        return this.findByIndex('tenantId', tenantId);
    }

    async findByStatus(status: string): Promise<FirewallType[]> {
        return this.findManyByIndex('status', status);
    }
}