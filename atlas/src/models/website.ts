import { Context } from "hono";
import { Env, WebsiteType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";
import { Domain } from "./domain";

const isWebsiteType = createTypeGuard<WebsiteType>(
    (data: any): data is WebsiteType => {
        return data.id !== undefined &&
            data.userId !== undefined;
    }
);

export class Website extends BaseModel<WebsiteType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'website', isWebsiteType);
    }

    protected defineIndexes(): void {
        this.addIndex({
            name: 'userId',
            keyExtractor: (website) => website.userId ? String(website.userId) : null,
            type: 'unique'
        });
    }

    async findByUrl(url: string): Promise<WebsiteType | null> {
        const domainModel = new Domain(this.c);
        const domain = await domainModel.findByUrl(url);
        if (!domain) {
          return null;
        }
        
        const website = await this.get(domain.websiteId);
        return website;
    }
}