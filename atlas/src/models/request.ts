import { Context } from "hono";
import { Env, RequestType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

const isRequestType = createTypeGuard<RequestType>(
    (data: any): data is RequestType => {
        return data.id !== undefined &&
            data.accountId !== undefined;
    }
);

export class Request extends BaseModel<RequestType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'request', isRequestType);
    }

    protected defineIndexes(): void {
        this.addIndex({
            name: 'accountId',
            keyExtractor: (request) => request.accountId ? String(request.accountId) : null,
            type: 'unique'
        });
    }

    async findByAccountId(accountId: string): Promise<RequestType | null> {
        return this.findByIndex('accountId', String(accountId));
    }
}