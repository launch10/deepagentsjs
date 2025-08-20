import { Context } from "hono";
import { Env, FirewallRuleType, TenantType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";
import { v4 as uuidv4 } from 'uuid';

const isFirewallRuleType = createTypeGuard<FirewallRuleType>(
    (data: any): data is FirewallRuleType => {
        return data.id !== undefined &&
            data.tenantId !== undefined &&
            data.url !== undefined
    }
);

export class FirewallRule extends BaseModel<FirewallRuleType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'firewall_rule', isFirewallRuleType);
    }

    protected defineIndexes(): void {
        this.addIndex({
            name: 'url',
            keyExtractor: (firewall) => firewall.url || null,
            type: 'unique'
        });

        this.addIndex({
            name: 'tenantId',
            keyExtractor: (firewall) => firewall.tenantId || null,
            type: 'list'
        });
    }

    async findByTenant(tenantId: string): Promise<FirewallRuleType[]> {
        return this.findManyByIndex('tenantId', tenantId);
    }

    // async block(rule: Partial<FirewallRuleType>): Promise<boolean> {
    //     if (!rule.url) {
    //         throw new Error('URL is required');
    //     }

    //     const [didBlock, id] = await updateFirewallList(this.c.env, rule.url);

    //     if (didBlock) {
    //         if (!rule.id) {
    //             rule.id = uuidv4();
    //         }
    //         if (!id) {
    //             throw new Error('Cloudflare ID is required');
    //         }
    //         rule = {...rule, status: 'blocked', cloudflareId: id};
    //         await this.set(rule.id, rule);
    //         return true;
    //     }

    //     return didBlock;
    // }

    // async unblock(rule: Pick<FirewallRuleType, 'id' | 'url'>): Promise<boolean> {
    //     const [didUnblock] = await removeFromFirewallList(this.c.env, rule.cloudflareId);

    //     if (didUnblock) {
    //         // Get the existing rule to preserve all fields
    //         const existingRule = await this.get(rule.id);
    //         if (!existingRule) {
    //             console.error(`Cannot unblock rule ${rule.id}: rule not found`);
    //             return false;
    //         }
            
    //         // Update only the status field, preserving all other fields
    //         await this.set(rule.id, {...existingRule, status: 'inactive'});
    //         return true;
    //     }

    //     return false;
    // }
}