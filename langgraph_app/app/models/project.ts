import { BaseModel } from "./base";
import { projectSchema } from "@types";
import { projects } from "app/db";

export class ProjectModel extends BaseModel<typeof projects, typeof projectSchema> {
  protected static table = projects;
  protected static schema = projectSchema;
}