import { Context } from "hono";
import { Env, FirewallType, TenantType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";
import { updateFirewallList } from '~/utils/cloudflareApi';
import { Request } from "./request";
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

  // just to make the type checker happy
  async fetch(request: Request): Promise<Response> {
    return new Response('ok');
  }

  async maybeActivateFirewall(c: Context<{ Bindings: Env }>, tenant: TenantType): Promise<boolean> {
    try {
      // If this is the first request for this site, initialize approximate count from KV
      if (this.count === 0) {
        const requestModel = new Request(c);
        const requests = await requestModel.findByTenantId(tenant.id);
        const count = requests ? requests.count : 0;
        await this.state.storage.put('count', count + 1);
      } else {
        this.count++;
        await this.state.storage.put('count', this.count);
      }
      

      const planModel = new Plan(c);
      const plan = await planModel.get(tenant.planId);

      if (!plan) {
        throw new Error(`Plan not found for ID: ${tenant.planId}`);
      }

      const tenantsLimit = planModel.getMonthlyLimit(plan);

      if (this.count > tenantsLimit) {
        // Fire-and-forget the API call to block the hostname
        const siteModel = new Site(c);
        const sites = await siteModel.findByTenant(tenant.id);

        sites.forEach(site => {
          this.state.waitUntil(
            updateFirewallList(c.env, site.url, 'add')
          );
        });
        
        return true;
      }
      return false;
    } catch (error: any) {
      // if we break this code, it could have catastrophic consequences,
      // so we should err on the side of caution and block the site
      return true;
    }
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

    async maybeActivate(tenant: TenantType): Promise<boolean> {
        const doId = this.c.env.FIREWALL.idFromName(tenant.id);
        const durableObject = this.c.env.FIREWALL.get(doId) as FirewallDO;
        const shouldBlock = await durableObject.maybeActivateFirewall(this.c, tenant);

        if (shouldBlock) {
            await this.set(tenant.id, { status: 'blocked' });
        }

        return shouldBlock;
    }

    async findByTenant(tenantId: string): Promise<FirewallType | null> {
        return this.findByIndex('tenantId', tenantId);
    }

    async findByStatus(status: string): Promise<FirewallType[]> {
        return this.findManyByIndex('status', status);
    }
}