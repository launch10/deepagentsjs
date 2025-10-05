import { BaseModel } from "./base";
import { themeVariantSchema } from "@types";
import { themeVariants as themeVariantsTable } from "app/db";
export class ThemeVariantModel extends BaseModel<typeof themeVariantsTable, typeof themeVariantSchema> {
  protected static table = themeVariantsTable;
  protected static schema = themeVariantSchema;
}