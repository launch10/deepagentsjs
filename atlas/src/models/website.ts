import { Context } from "hono";
import { Env, WebsiteType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

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
}