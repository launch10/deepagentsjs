import { BaseModel } from "./base";
import { themeSchema } from "@types";
import { themes as themesTable } from "app/db";

export class ThemeModel extends BaseModel<typeof themesTable, typeof themeSchema> {
  protected static table = themesTable;
  protected static schema = themeSchema;
}