import { z } from "zod";
import { primaryKeySchema, uuidSchema, baseModelSchema } from "../core";

export const websiteSchema = baseModelSchema.extend({
    name: z.string().describe("Name of the website"),
    accountId: primaryKeySchema.optional().describe("ID of the user associated with the account owner"),
    projectId: primaryKeySchema.optional().describe("ID of the project associated with the website"),
    threadId: uuidSchema.optional().describe("ID of the thread associated with the website"),
    templateId: primaryKeySchema.optional().describe("ID of the template associated with the website"),
    themeId: primaryKeySchema.optional().describe("ID of the theme associated with the website"),
}).describe("Represents a website");

export type WebsiteType = z.infer<typeof websiteSchema>;