import { z } from "zod";
import { PageTypeEnum } from "./enums";
import { primaryKeySchema, baseModelSchema } from "../core";
import { componentOverviewPromptSchema } from "./component";

export { PageTypeEnum };

export const pageSchema = baseModelSchema.extend({
  name: z.string().optional().describe("Name of the page"),
  path: z.string().optional().describe("The relative path of the page (e.g., '/index')."),
  pageType: z.nativeEnum(PageTypeEnum).describe("Type of the page (e.g., 'IndexPage', 'PricingPage', 'AboutPage', 'ContactPage', 'OtherPage')."),
  websiteId: primaryKeySchema.describe("ID of the website this page belongs to"),
  websiteFileId: primaryKeySchema.describe("ID of the website file this page is associated with"),
  fileSpecificationId: primaryKeySchema.describe("ID of the file specification for this page"),
}).describe("Page plan");

export type PageType = z.infer<typeof pageSchema>;

const pagePlanSharedFields = z.object({
  pageType: z.nativeEnum(PageTypeEnum).describe("Type of the page (e.g., 'IndexPage', 'PricingPage', 'AboutPage', 'ContactPage', 'OtherPage')."),
  description: z.string().optional().describe("Optional description or notes about the page's purpose or content."),
})
// A prompt schema is what the AI MODEL sees, as opposed to the normalized 
// database schema
export const pagePlanPromptSchema = pagePlanSharedFields.extend({
  components: z.array(componentOverviewPromptSchema).describe("Component plans for the page."),
}).describe("Page plan");

export type PagePlanType = z.infer<typeof pagePlanPromptSchema>;