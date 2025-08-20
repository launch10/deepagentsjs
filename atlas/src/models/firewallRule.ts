import { Context } from "hono";
import { Env, FirewallRuleType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

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
}