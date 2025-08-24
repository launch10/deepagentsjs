import { Context } from "hono";
import { Env, AccountType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

const isAccountType = createTypeGuard<AccountType>(
    (data: any): data is AccountType => {
        return data.id !== undefined
    }
);

export class Account extends BaseModel<AccountType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'account', isAccountType);
    }

    protected defineIndexes(): void {
        this.addIndex({
            name: 'planId',
            keyExtractor: (account) => account.planId ? String(account.planId) : null,
            type: 'unique'
        });
    }
}