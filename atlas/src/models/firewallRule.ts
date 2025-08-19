import { Context } from "hono";
import { Env, FirewallRuleType, TenantType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";
import { updateFirewallList } from '~/utils/cloudflareApi';
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

    async block(rule: Partial<FirewallRuleType>): Promise<boolean> {
        if (!rule.url) {
            throw new Error('URL is required');
        }

        const didBlock = await updateFirewallList(this.c.env, rule.url, 'add');

        if (didBlock) {
            if (!rule.id) {
                rule.id = uuidv4();
            }
            await this.set(rule.id, {...rule, status: 'blocked', blockedAt: new Date()});
            return true;
        }

        return didBlock;
    }

    async unblock(rule: Pick<FirewallRuleType, 'id' | 'url'>): Promise<boolean> {
        const didUnblock = await updateFirewallList(this.c.env, rule.url, 'remove');

        if (didUnblock) {
            await this.set(rule.id, {...rule, status: 'inactive', blockedAt: undefined });
            return true;
        }

        return didUnblock;
    }
}