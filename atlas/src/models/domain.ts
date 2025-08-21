import { Context } from "hono";
import { Env, DomainType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

const isDomainType = createTypeGuard<DomainType>(
    (data: any): data is DomainType => {
        return data.id !== undefined &&
            data.websiteId !== undefined &&
            data.domain !== undefined;
    }
);

export class Domain extends BaseModel<DomainType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'domain', isDomainType);
    }

    protected defineIndexes(): void {
        this.addIndex('websiteId', 'websiteId');
        this.addIndex('domain', 'domain');
    }

    async findByDomain(domain: string): Promise<DomainType | null> {
        return this.findByIndex('domain', domain);
    }

    async findByWebsiteId(websiteId: string): Promise<DomainType[]> {
        return this.findManyByIndex('websiteId', websiteId);
    }
}