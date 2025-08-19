import { Context } from "hono";
import { Env, PlanType, PlanName, usageThresholdPercent } from "~/types";
import { BaseModel, createTypeGuard } from "./base";

const isPlanType = createTypeGuard<PlanType>(
    (data: any): data is PlanType => {
        return data.id !== undefined &&
            data.name !== undefined &&
            data.usageLimit !== undefined;
    }
);

const MonthlyPlanLimit: Record<PlanName, number> = {
    starter: 25, // 1_000_000,
    pro: 5_000_000,
    enterprise: 20_000_000
}
export class Plan extends BaseModel<PlanType> {
    constructor(c: Context<{ Bindings: Env }>) {
        super(c, 'plan', isPlanType);
    }

    protected defineIndexes(): void {
        this.addIndex({
            name: 'id',
            keyExtractor: (plan) => plan.id || null,
            type: 'unique'
        });
    }

    getMonthlyLimit(plan: PlanType): number {
        return MonthlyPlanLimit[plan.name.toLowerCase() as PlanName] || MonthlyPlanLimit['starter'];
    }
}