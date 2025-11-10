import { z } from "zod";
import { ComponentTypeEnum, SectionTypeEnum, BackgroundColorEnum, LayoutTypeEnum, PageTypeEnum, ConfigTypeEnum, StyleTypeEnum } from "./enums";
import { baseModelSchema, primaryKeySchema, type DataType } from "../core";

// Import all section schemas
import { heroSchema, type HeroType } from "./registries/fileSpecs/section/hero";
import { benefitsSchema, type BenefitsType } from "./registries/fileSpecs/section/benefits";
import { ctaSchema, type CtaType } from "./registries/fileSpecs/section/cta";
import { customSchema, type CustomType } from "./registries/fileSpecs/section/custom";
import { faqSchema, type FaqType } from "./registries/fileSpecs/section/faq";
import { featuresSchema, type FeaturesType } from "./registries/fileSpecs/section/features";
import { howItWorksSchema, type HowItWorksType } from "./registries/fileSpecs/section/howItWorks";
import { pricingSchema, type PricingType } from "./registries/fileSpecs/section/pricing";
import { socialProofSchema, type SocialProofType } from "./registries/fileSpecs/section/socialProof";
import { teamSchema, type TeamType } from "./registries/fileSpecs/section/team";
import { testimonialsSchema, type TestimonialsType } from "./registries/fileSpecs/section/testimonials";
import { footerSchema, type FooterType } from "./registries/fileSpecs/layout/footer";
import { navSchema, type NavType } from "./registries/fileSpecs/layout/nav";
import type { ComponentOverviewType, ThemeType } from ".";
export { 
  type HeroType, 
  type BenefitsType, 
  type CtaType, 
  type CustomType, 
  type FaqType, 
  type FeaturesType, 
  type HowItWorksType, 
  type PricingType, 
  type SocialProofType, 
  type TeamType, 
  type TestimonialsType, 
  type FooterType, 
  type NavType 
};

// Re-export enums for convenience
export { ComponentTypeEnum, SectionTypeEnum, LayoutTypeEnum, PageTypeEnum, ConfigTypeEnum, StyleTypeEnum } from "./enums";
export { BackgroundColorEnum } from "./enums";

export const sectionLayoutSchema = z.object({
  recommendedIcons: z.array(z.string()).nullable().optional().describe("Recommended icons for the section."),
  layoutDescription: z.string().nullable().optional().describe("A description of the layout for the section."),
  layoutEmphasis: z.string().nullable().optional().describe("The visual focus of the section."),
  visualStyleNotes: z.string().nullable().optional().describe("A description of the visual style for the section."),
  responsivenessNotes: z.string().nullable().optional().describe("A description of the responsiveness for the section."),
})

export const componentContentSchema = z.discriminatedUnion("componentType", [
    heroSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.Hero) }),
    benefitsSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.Benefits) }),
    ctaSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.CTA) }),
    customSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.Custom) }),
    faqSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.FAQ) }),
    featuresSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.Features) }),
    howItWorksSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.HowItWorks) }),
    pricingSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.Pricing) }),
    socialProofSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.SocialProof) }),
    teamSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.Team) }),
    testimonialsSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(SectionTypeEnum.Testimonials) }),
    navSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(LayoutTypeEnum.Nav) }),
    footerSchema.extend(sectionLayoutSchema.shape).extend({ componentType: z.literal(LayoutTypeEnum.Footer) }),
]);

export type ComponentContentType = z.infer<typeof componentContentSchema>;

export const componentTypeSchema = z.union([
  z.nativeEnum(PageTypeEnum),
  z.nativeEnum(SectionTypeEnum),
  z.nativeEnum(LayoutTypeEnum),
  z.nativeEnum(ConfigTypeEnum),
  z.nativeEnum(StyleTypeEnum),
]);

export const componentOverviewPromptSchema = z.object({
  name: z.string().describe("Unique TitleCaseIdentifier for the component. Will be used for both the component name, and the component path. By default, you should use the componentType as the componentId, unless it will conflict with another component."),
  componentType: componentTypeSchema.describe("Categorization of the component's purpose and typical structure."),
  purpose: z.string().describe("What is the primary communication goal of this component? (e.g., 'Establish credibility', 'Provide navigation', 'Drive sign-ups')."),
  context: z.string().describe("Explain the context of the component, and how it fits into the overall site/page."),
  copy: z.string().optional().describe("Any existing copy provided by the user that should be included in the described component."),
  backgroundColor: z.nativeEnum(BackgroundColorEnum).describe("The primary background color for the component (Primary=the primary theme color, Secondary=the secondary theme color, Background=background color, Muted=muted, Accent=accent, Neutral=neutral).")
});
export type ComponentOverviewPromptType = z.infer<typeof componentOverviewPromptSchema>;

// Component overview schema - can be used for any component type (sections, layouts, pages, etc.)
export const componentOverviewSchema = baseModelSchema.extend(componentOverviewPromptSchema.shape).extend({
  // foreign keys
  path: z.string().optional().describe("The relative path of the file to update"),
  sortOrder: z.number().optional().describe("The order of the component in the page."),
  websiteId: primaryKeySchema.optional().describe("The ID of the website this component belongs to."),
  pageId: primaryKeySchema.optional().describe("The ID of the page this component belongs to."),
  componentId: primaryKeySchema.optional().describe("Unique TitleCaseIdentifier for the component. Will be used for both the component name, and the component path. By default, you should use the componentType as the componentId, unless it will conflict with another component."),
  fileSpecificationId: primaryKeySchema.optional().describe("The ID of the file specification for this component."),
});

export type OverviewType = z.infer<typeof componentOverviewSchema>;

// export const componentOverviewSchemaOriginal = z.object({
//   componentId: z.string().describe("Unique TitleCaseIdentifier for the component. Will be used for both the component name, and the component path. By default, you should use the componentType as the componentId, unless it will conflict with another component."),
//   page: z.nativeEnum(PageTypeEnum).default(PageTypeEnum.IndexPage).describe("Logical page this component belongs to."),
//   name: z.string().describe("Descriptive, human-readable name for this component (e.g., 'Hero Banner', 'Navigation Bar', 'Pricing Page'). This corresponds to the user's likely description."),
//   componentType: componentTypeSchema.describe("Categorization of the component's purpose and typical structure."),
//   purpose: z.string().describe("What is the primary communication goal of this component? (e.g., 'Establish credibility', 'Provide navigation', 'Drive sign-ups')."),
//   context: z.string().describe("Explain the context of the component, and how it fits into the overall site/page."),
//   copy: z.string().optional().describe("Any existing copy provided by the user that should be included in the described component."),
//   backgroundColor: z.nativeEnum(BackgroundColorEnum).describe("The primary background color for the component (Primary=the primary theme color, Secondary=the secondary theme color, Background=background color, Muted=muted, Accent=accent, Neutral=neutral)."),
//   exportName: z.string().optional().describe("Export name for the file"),
//   filePath: z.string().optional().describe("The relative path of the file to update"),
// });

// export type OverviewTypeOriginal = z.infer<typeof componentOverviewSchemaOriginal>;

export type BackgroundColorKey = Lowercase<keyof typeof BackgroundColorEnum>;
export const backgroundColorKey = Object.keys(BackgroundColorEnum).map(key => key.toLowerCase()) as BackgroundColorKey[];

export const componentContentPlanSchema = baseModelSchema.extend({
  componentType: componentTypeSchema.describe("The type of section this component is."),
  data: componentContentSchema.optional().describe("The content plan for this component."),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  componentId: primaryKeySchema.optional().describe("The ID of the component for this content plan."),
}).describe("Content plan for a component");
export type ComponentContentPlanType = z.infer<typeof componentContentPlanSchema>;

export const componentPlanSchema = z.object({
  overview: componentOverviewSchema.optional().describe("The overview of the component."),
  contentPlan: componentContentPlanSchema.optional().describe("The content plan for the component."),
}).describe("Component plan");
export type ComponentPlanType = z.infer<typeof componentPlanSchema>;

// export const componentPlanSchema = z.object({
//   overview: componentOverviewSchema.optional().describe("The overview of the component."),
//   data: sectionTypeSchema.optional().describe("The content of the component.")
// }).describe("Component plan");
// export type ComponentPlanType = z.infer<typeof componentPlanSchema>;

export const themeVariantSchema = baseModelSchema.extend({
  backgroundClass: z.string().describe("The semantic utility class to be used as the background color."),
  foregroundClass: z.string().describe("The semantic utility class to be used as the foreground color."),
  mutedClass: z.string().describe("The semantic utility class to be used as the muted foreground color."),
  primaryClass: z.string().describe("The semantic utility class to be used as the primary foreground color."),
  secondaryClass: z.string().describe("The semantic utility class to be used as the secondary foreground color."),
  accentClass: z.string().describe("The semantic utility class to be used as the accent foreground color."),
});
export type ThemeVariantType = z.infer<typeof themeVariantSchema>;

// Define a simple file schema inline to avoid circular dependency
// const fileSchema = z.object({
//   path: z.string().describe("Path of the file"),
//   data: z.string().describe("Content of the file"),
//   fileSpecId: z.number().optional().describe("ID of the file specification"),
// });

// export const componentSchemaOriginal = z.object({
//   componentId: z.string().describe("Unique TitleCaseIdentifier for the component. Will be used for both the component name, and the component path. By default, you should use the componentType as the componentId, unless it will conflict with another component."),
//   componentType: z.nativeEnum(ComponentTypeEnum).describe("Categorization of the component's purpose and typical structure (Content Sections Only)."),
//   componentPlan: componentPlanSchema.optional().describe("The content plan for this component."),
//   filePath: z.string().describe("The relative path of the file to update (must be one of the provided file paths)."),
//   file: fileSchema.optional().describe("The file for this component."),
//   theme: themeSchema,
//   exportName: z.string().optional().describe("Export name for the file"),
// });
// export type ComponentTypeOriginal = z.infer<typeof componentSchemaOriginal>;

export const componentSchema = baseModelSchema.extend({
  name: z.string().describe("Unique TitleCaseIdentifier for the component. Will be used for both the component name, and the component path. By default, you should use the componentType as the name, unless it will conflict with another component."),
  websiteId: primaryKeySchema.describe("The ID of the website this component belongs to."),
  pageId: primaryKeySchema.describe("The ID of the page this component belongs to."),
  path: z.string().describe("The relative path of the file to update (must be one of the provided file paths)."),
  componentType: componentTypeSchema.describe("Categorization of the component's purpose and typical structure (Content Sections Only)."),
  fileSpecificationId: primaryKeySchema.optional().describe("The ID of the file specification for this component."),
  themeVariantId: primaryKeySchema.optional().describe("The ID of the theme variant for this component."),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component plan for this component."),
  componentPlanId: primaryKeySchema.optional().describe("The ID of the content plan for this component."),
});
export type ComponentType = z.infer<typeof componentSchema>;

// Theme helpers
export type ThemeVariantDataType = DataType<ThemeVariantType>;
const componentThemeMap: Record<BackgroundColorKey, ThemeVariantDataType> = {
  "background": {
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
};

export const getComponentTheme = (backgroundColor: BackgroundColorKey, componentType?: ComponentTypeEnum): ThemeVariantDataType => {
  if (componentType && componentType === ComponentTypeEnum.Nav || componentType === ComponentTypeEnum.Footer) {
    return componentThemeMap["background"];
  }

  return componentThemeMap[backgroundColor];
};

// Content plan schemas for specific section types
export const heroComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.Hero),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: heroSchema.optional().describe("The content of the section.")
}).describe("Hero section plan");
export type HeroComponentPlan = z.infer<typeof heroComponentPlanSchema>;

export const benefitsComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.Benefits),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: benefitsSchema.optional().describe("The content of the section.")
}).describe("Benefits section plan");
export type BenefitsComponentPlan = z.infer<typeof benefitsComponentPlanSchema>;

export const ctaComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.CTA),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: ctaSchema.optional().describe("The content of the section.")
}).describe("CTA section plan");
export type CTAComponentPlan = z.infer<typeof ctaComponentPlanSchema>;

export const customComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.Custom),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: customSchema.optional().describe("The content of the section.")
}).describe("Custom section plan");
export type CustomComponentPlan = z.infer<typeof customComponentPlanSchema>;

export const faqComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.FAQ),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: faqSchema.optional().describe("The content of the section.")
}).describe("FAQ section plan");
export type FAQComponentPlan = z.infer<typeof faqComponentPlanSchema>;

export const featuresComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.Features),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: featuresSchema.optional().describe("The content of the section.")
}).describe("Features section plan");
export type FeaturesComponentPlan = z.infer<typeof featuresComponentPlanSchema>;

export const howItWorksComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.HowItWorks),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: howItWorksSchema.optional().describe("The content of the section.")
}).describe("How It Works section plan");
export type HowItWorksComponentPlan = z.infer<typeof howItWorksComponentPlanSchema>;

export const pricingComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.Pricing),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: pricingSchema.optional().describe("The content of the section.")
}).describe("Pricing section plan");
export type PricingComponentPlan = z.infer<typeof pricingComponentPlanSchema>;

export const socialProofComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.SocialProof),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: socialProofSchema.optional().describe("The content of the section.")
}).describe("Social Proof section plan");
export type SocialProofComponentPlan = z.infer<typeof socialProofComponentPlanSchema>;

export const teamComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.Team),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: teamSchema.optional().describe("The content of the section.")
}).describe("Team section plan");
export type TeamComponentPlan = z.infer<typeof teamComponentPlanSchema>;

export const testimonialsComponentPlanSchema = z.object({
  componentType: z.literal(SectionTypeEnum.Testimonials),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: testimonialsSchema.optional().describe("The content of the section.")
}).describe("Testimonials section plan");
export type TestimonialsComponentPlan = z.infer<typeof testimonialsComponentPlanSchema>;

export const footerComponentPlanSchema = z.object({
  componentType: z.literal(LayoutTypeEnum.Footer),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: footerSchema.optional().describe("The content of the section.")
}).describe("Footer section plan");
export type FooterComponentPlan = z.infer<typeof footerComponentPlanSchema>;

export const navComponentPlanSchema = z.object({
  componentType: z.literal(LayoutTypeEnum.Nav),
  componentOverviewId: primaryKeySchema.optional().describe("The ID of the component overview for this component."),
  data: navSchema.optional().describe("The content of the section.")
}).describe("Nav section plan");
export type NavComponentPlan = z.infer<typeof navComponentPlanSchema>;

// Export all schemas
export {
  heroSchema,
  benefitsSchema,
  ctaSchema,
  customSchema,
  faqSchema,
  featuresSchema,
  howItWorksSchema,
  pricingSchema,
  socialProofSchema,
  teamSchema,
  testimonialsSchema,
  footerSchema,
  navSchema,
};

// Export all schemas for convenience
export const componentPlanSchemas = {
  [SectionTypeEnum.Hero]: heroComponentPlanSchema,
  [SectionTypeEnum.Benefits]: benefitsComponentPlanSchema,
  [SectionTypeEnum.CTA]: ctaComponentPlanSchema,
  [SectionTypeEnum.Custom]: customComponentPlanSchema,
  [SectionTypeEnum.FAQ]: faqComponentPlanSchema,
  [SectionTypeEnum.Features]: featuresComponentPlanSchema,
  [SectionTypeEnum.HowItWorks]: howItWorksComponentPlanSchema,
  [SectionTypeEnum.Pricing]: pricingComponentPlanSchema,
  [SectionTypeEnum.SocialProof]: socialProofComponentPlanSchema,
  [SectionTypeEnum.Team]: teamComponentPlanSchema,
  [SectionTypeEnum.Testimonials]: testimonialsComponentPlanSchema,
  [LayoutTypeEnum.Footer]: footerComponentPlanSchema,
  [LayoutTypeEnum.Nav]: navComponentPlanSchema,
} as const;

// Union type of all specific content plans
export type SpecificComponentPlan = 
  | HeroComponentPlan
  | BenefitsComponentPlan
  | CTAComponentPlan
  | CustomComponentPlan
  | FAQComponentPlan
  | FeaturesComponentPlan
  | HowItWorksComponentPlan
  | PricingComponentPlan
  | SocialProofComponentPlan
  | TeamComponentPlan
  | TestimonialsComponentPlan
  | FooterComponentPlan
  | NavComponentPlan;

export const getComponentPlanSchema = (overview: ComponentOverviewType): z.ZodSchema => {
  const componentType = overview.componentType;
  
  if (!componentType) {
    return z.any().describe("Generic content schema");
  }
  
  const sectionSchemaMap: Record<string, z.ZodSchema> = {
    [SectionTypeEnum.Hero]: heroSchema.extend({ componentType: z.literal(SectionTypeEnum.Hero) }),
    [SectionTypeEnum.Features]: featuresSchema.extend({ componentType: z.literal(SectionTypeEnum.Features) }),
    [SectionTypeEnum.Benefits]: benefitsSchema.extend({ componentType: z.literal(SectionTypeEnum.Benefits) }),
    [SectionTypeEnum.CTA]: ctaSchema.extend({ componentType: z.literal(SectionTypeEnum.CTA) }),
    [SectionTypeEnum.FAQ]: faqSchema.extend({ componentType: z.literal(SectionTypeEnum.FAQ) }),
    [SectionTypeEnum.Pricing]: pricingSchema.extend({ componentType: z.literal(SectionTypeEnum.Pricing) }),
    [SectionTypeEnum.Testimonials]: testimonialsSchema.extend({ componentType: z.literal(SectionTypeEnum.Testimonials) }),
    [SectionTypeEnum.SocialProof]: socialProofSchema.extend({ componentType: z.literal(SectionTypeEnum.SocialProof) }),
    [SectionTypeEnum.HowItWorks]: howItWorksSchema.extend({ componentType: z.literal(SectionTypeEnum.HowItWorks) }),
    [SectionTypeEnum.Team]: teamSchema.extend({ componentType: z.literal(SectionTypeEnum.Team) }),
    [SectionTypeEnum.Custom]: customSchema.extend({ componentType: z.literal(SectionTypeEnum.Custom) }),
  };
  
  // Map of layout types to their content schemas
  const layoutSchemaMap: Record<string, z.ZodSchema> = {
    [LayoutTypeEnum.Nav]: navSchema.extend({ componentType: z.literal(LayoutTypeEnum.Nav) }),
    [LayoutTypeEnum.Footer]: footerSchema.extend({ componentType: z.literal(LayoutTypeEnum.Footer) }),
  };
  
  // Return the appropriate schema
  return sectionSchemaMap[componentType] || layoutSchemaMap[componentType] || z.any().describe("Unknown component type");
};

