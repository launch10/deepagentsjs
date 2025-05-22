import { z } from "zod";
import { SectionTypeEnum, PageTypeEnum } from "./enums";
import { sectionTypeSchema } from "./registry/sectionRegistry";
import { fileSchema } from "./file";

// These will be class names like "--background", "--primary", "--secondary", etc.
export const sectionThemeSchema = z.object({
  backgroundClass: z.string().describe("The semantic utility class to be used as the background color."),
  foregroundClass: z.string().describe("The semantic utility class to be used as the foreground color."),
  mutedClass: z.string().describe("The semantic utility class to be used as the muted foreground color."),
  primaryClass: z.string().describe("The semantic utility class to be used as the primary foreground color."),
  secondaryClass: z.string().describe("The semantic utility class to be used as the secondary foreground color."),
  accentClass: z.string().describe("The semantic utility class to be used as the accent foreground color."),
})
export type SectionTheme = z.infer<typeof sectionThemeSchema>;

const sectionThemeMap = {
  "white": {
    backgroundClass: "--background",
    foregroundClass: "--foreground",
    mutedClass: "--foreground-muted",
    primaryClass: "--primary",
    secondaryClass: "--secondary",
    accentClass: "--accent",
  },
  "primary": {
    backgroundClass: "--primary",
    foregroundClass: "--primary-foreground",
    mutedClass: "--primary-foreground-muted",
    primaryClass: "--background",
    secondaryClass: "--secondary",
    accentClass: "--accent",
  },
  "secondary": {
    backgroundClass: "--secondary",
    foregroundClass: "--secondary-foreground",
    mutedClass: "--secondary-foreground-muted",
    primaryClass: "--primary",
    secondaryClass: "--background",
    accentClass: "--secondary-foreground",
  },
  "neutral": {
    backgroundClass: "--neutral",
    foregroundClass: "--neutral-foreground",
    mutedClass: "--neutral-foreground-muted",
    primaryClass: "--primary",
    secondaryClass: "--secondary",
    accentClass: "--neutral-foreground",
  },
  "muted": {
    backgroundClass: "--muted",
    foregroundClass: "--muted-foreground",
    mutedClass: "--muted-foreground-muted",
    primaryClass: "--primary",
    secondaryClass: "--secondary",
    accentClass: "--muted-foreground",
  },
  "accent": {
    backgroundClass: "--accent",
    foregroundClass: "--accent-foreground",
    mutedClass: "--accent-foreground-muted",
    primaryClass: "--accent-foreground",
    secondaryClass: "--accent-foreground-muted",
    accentClass: "--accent-foreground",
  },
}
export const getSectionTheme = (backgroundColor: BackgroundColorEnum): SectionTheme => {
  return sectionThemeMap[backgroundColor.toLowerCase()];
}

export const getRandomSectionTheme = (): SectionTheme => {
  return sectionThemeMap[Math.floor(Math.random() * Object.keys(sectionThemeMap).length)];
}

export type SectionType = typeof SectionTypeEnum;

export enum BackgroundColorEnum {
  Primary = "Primary",
  Secondary = "Secondary",
  White = "White",
  Muted = "Muted",
  Accent = "Accent",
  Neutral = "Neutral",
}

export const sectionOverviewSchema = z.object({
  componentId: z.string().describe("Unique TitleCaseIdentifier for the component. Will be used for both the component name, and the component path. By default, you should use the sectionType as the componentId, unless it will conflict with another component."),
  page: z.nativeEnum(PageTypeEnum).default(PageTypeEnum.IndexPage).describe("Logical page this section belongs to."),
  name: z.string().describe("Descriptive, human-readable name for this section (e.g., 'Hero Banner', 'Key Features Grid', 'Customer Love'). This corresponds to the user's likely description."),
  sectionType: z.nativeEnum(SectionTypeEnum).describe("Categorization of the section's purpose and typical structure (Content Sections Only)."),
  purpose: z.string().describe("What is the primary communication goal of this section? (e.g., 'Establish credibility', 'Explain the core value proposition', 'Address common objections', 'Drive sign-ups')."),
  context: z.string().describe("Explain the context of the section, and how it fits into the overall page."),
  copy: z.string().optional().describe("Any existing copy provided by the user that should be included in the described section."),
  backgroundColor: z.nativeEnum(BackgroundColorEnum).describe("The primary background color for the section (Primary=the primary theme color, Secondary=the secondary theme color, White=white, Muted=muted, Accent=accent, Neutral=neutral).")
});

// Type inferred from the schema
export type SectionOverview = z.infer<typeof sectionOverviewSchema>;

export const sectionLayoutSchema = z.object({
  recommendedIcons: z.array(z.string()).describe("Recommended icons for the section."),
  layoutDescription: z.string().describe("A description of the layout for the section."),
  layoutEmphasis: z.string().describe("The visual focus of the section."),
  visualStyleNotes: z.string().describe("A description of the visual style for the section."),
  responsivenessNotes: z.string().describe("A description of the responsiveness for the section."),
})

export const contentPlanSchema = z.object({
  overview: sectionOverviewSchema.optional().describe("The overview of the section."),
  content: sectionTypeSchema.optional().describe("The content of the section.")
}).describe("Section plan");

export type ContentPlan = z.infer<typeof contentPlanSchema>;

export const sectionSchema = z.object({
  sectionType: z.nativeEnum(SectionTypeEnum).describe("Categorization of the section's purpose and typical structure (Content Sections Only)."),
  contentPlan: contentPlanSchema.optional().describe("The content plan for this section."),
  filePath: z.string().describe("The relative path of the file to update (must be one of the provided file paths)."),
  file: fileSchema.describe("The file for this section."),
  theme: sectionThemeSchema,
});
export type Section = z.infer<typeof sectionSchema>