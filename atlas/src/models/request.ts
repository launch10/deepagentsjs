import { Context } from "hono";
import { Env, RequestType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

const isRequestType = createTypeGuard<RequestType>(
    (data: any): data is RequestType => {
        return data.id !== undefined &&
            data.userId !== undefined;
    }
);

export class Request extends BaseModel<RequestType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'request', isRequestType);
    }

    protected defineIndexes(): void {
        this.addIndex({
            name: 'userId',
            keyExtractor: (request) => request.userId ? String(request.userId) : null,
            type: 'unique'
        });
    }

    async findByUserId(userId: string): Promise<RequestType | null> {
        return this.findByIndex('userId', String(userId));
    }
}