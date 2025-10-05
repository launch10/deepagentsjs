import { templateFiles } from "app/db";
import { templateFileSchema } from "@types";
import { BaseModel } from "./base";
export class TemplateFileModel extends BaseModel<typeof templateFiles, typeof templateFileSchema> {
    protected static table = templateFiles;
    protected static schema = templateFileSchema;
}