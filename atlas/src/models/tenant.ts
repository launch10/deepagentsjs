import { Context } from "hono";
import { Env, TenantType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

const isTenantType = createTypeGuard<TenantType>(
    (data: any): data is TenantType => {
        return data.id !== undefined &&
            data.orgId !== undefined;
    }
);
export class Tenant extends BaseModel<TenantType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'tenant', isTenantType);
    }

    protected defineIndexes(): void {
    }
}