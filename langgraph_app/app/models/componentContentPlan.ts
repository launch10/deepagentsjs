import { BaseModel } from "./base";
import { componentContentPlans } from "../db/schema";
import { componentContentPlanSchema } from "@types";

export class ComponentContentPlanModel extends BaseModel<typeof componentContentPlans, typeof componentContentPlanSchema> {
  protected static override table = componentContentPlans;
  protected static override schema = componentContentPlanSchema;
}