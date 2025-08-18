import { Context } from "hono";
import { Env, PlanType } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

const isPlanType = createTypeGuard<PlanType>(
    (data: any): data is PlanType => {
        return data.id !== undefined &&
            data.name !== undefined &&
            data.usageLimit !== undefined;
    }
);

export class Plan extends BaseModel<PlanType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'plan', isPlanType);
    }
}