import { Context } from "hono";
import { Env, SiteType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

const isSiteType = createTypeGuard<SiteType>(
    (data: any): data is SiteType => {
        return data.id !== undefined &&
            data.tenantId !== undefined &&
            data.url !== undefined
    }
);

export class Site extends BaseModel<SiteType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'site', isSiteType);
    }

    protected defineIndexes(): void {
        this.addIndex({
            name: 'url',
            keyExtractor: (site) => site.url,
            type: 'unique'
        });

        this.addIndex({
            name: 'tenantId',
            keyExtractor: (site) => site.tenantId,
            type: 'list'
        });
    }

    async findByUrl(url: string): Promise<SiteType | null> {
        const hostname = new URL(url).hostname;
        return this.findByIndex('url', hostname);
    }

    async findByTenant(tenantId: string): Promise<SiteType[]> {
        return this.findManyByIndex('tenantId', tenantId);
    }
}