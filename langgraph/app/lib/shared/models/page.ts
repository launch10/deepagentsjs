import { z } from "zod";
import { PageTypeEnum } from "./enums";
import { sectionSchema, sectionOverviewSchema } from "./section";

export type CorePageType = PageTypeEnum.IndexPage | PageTypeEnum.PricingPage;

export const pagePlanSchema = z.object({
    name: z.nativeEnum(PageTypeEnum).describe("Type of the page (e.g., 'IndexPage', 'PricingPage', 'AboutPage', 'ContactPage', 'OtherPage')."),
    subtype: z.nativeEnum(PageTypeEnum).describe("Type of the page (e.g., 'IndexPage', 'PricingPage', 'AboutPage', 'ContactPage', 'OtherPage')."),
    sections: z.array(sectionOverviewSchema).describe("Section plans for the page."),
    description: z.string().optional().describe("Optional description or notes about the page's purpose or content.")
}).describe("Page plan");

export type PagePlan = z.infer<typeof pagePlanSchema>;

export const pageSchema = z.object({
    subtype: z.nativeEnum(PageTypeEnum).describe("Type of the page (e.g., 'IndexPage', 'PricingPage', 'AboutPage', 'ContactPage', 'OtherPage')."),
    plan: pagePlanSchema.optional().describe("Plan for the page."),
    sections: z.array(sectionSchema).optional().describe("Section plans for the page."),
    filePath: z.string().describe("The relative path of the page file (e.g., 'src/pages/IndexPage.tsx')."),
}).describe("Page plan");

export type PageData = z.infer<typeof pageSchema>