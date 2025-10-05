import { z } from "zod";
import { primaryKeySchema, baseModelSchema } from "../core";

export const templateSchema = baseModelSchema.extend({
    name: z.string().describe("Name of the template"),
}).describe("Represents a template");

export type TemplateType = z.infer<typeof templateSchema>;

export const templateFileSchema = baseModelSchema.extend({
    templateId: primaryKeySchema.describe("ID of the template this file belongs to"),
    path: z.string().describe("Path to the file relative to the template directory"),
    content: z.string().describe("Content of the file"),
    fileSpecificationId: primaryKeySchema.describe("ID of the file specification for this file")
});
export type TemplateFileType = z.infer<typeof templateFileSchema>;