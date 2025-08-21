import { Context } from "hono";
import { Env, UserType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

const isUserType = createTypeGuard<UserType>(
    (data: any): data is UserType => {
        return data.id !== undefined &&
            data.planId !== undefined;
    }
);

export class User extends BaseModel<UserType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'user', isUserType);
    }

    protected defineIndexes(): void {
        this.addIndex('planId', 'planId');
    }
}