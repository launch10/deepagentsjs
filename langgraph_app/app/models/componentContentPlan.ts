import { BaseModel } from "./base";
import { componentContentPlans } from "../db/schema";
import { componentContentPlanSchema } from "../shared/types/website/component";

export class ComponentContentPlanModel extends BaseModel<typeof componentContentPlans, typeof componentContentPlanSchema> {
  protected static table = componentContentPlans;
  protected static schema = componentContentPlanSchema;
}