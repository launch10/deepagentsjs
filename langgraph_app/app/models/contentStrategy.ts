import { Website } from "@types";
import { BaseModel } from "./base";
import { contentStrategies } from "app/db";

export class ContentStrategyModel extends BaseModel<
  typeof contentStrategies, 
  typeof Website.Plan.contentStrategySchema
> {
    protected static table = contentStrategies;
    protected static schema = Website.Plan.contentStrategySchema;
}