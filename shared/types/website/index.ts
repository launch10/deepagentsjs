// Barrel exports using ES modules
export * as Component from "./component";
export * as Page from "./page";
export * as File from "./file";
export * as Plan from "./contentStrategy";
export * as Template from "./template";
export * as Theme from "./theme";
export * as Icons from "./icons";
export * from "./enums";
export * from "./errors";

export { 
  componentTypeSchema,
  componentSchema,
  componentContentPlanSchema,
  componentOverviewSchema,
  componentOverviewPromptSchema,
  themeVariantSchema,
  getComponentPlanSchema,
  getComponentTheme,
  type ThemeVariantType,
  type ThemeVariantDataType,
  type OverviewType as ComponentOverviewType,
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
  type NavType, 
  type FooterType,
  type BackgroundColorKey,
  type ComponentType,
  type ComponentContentPlanType,
  type ComponentOverviewPromptType,
  backgroundColorKey,
} from "./component";

export { type WebsiteType, websiteSchema } from "./website";
export type { FileMap, FileType, FileSpecType, WebsiteFileType, CodeFileType } from "./file";
export { websiteFileSchema, codeFileSchema, fileSpecSchema, fileSchema, CodeFileSourceEnum } from "./file";
export type { PageType } from "./page";
export { pageSchema, pagePlanPromptSchema, type PagePlanType } from "./page";
export { type ContentStrategyType,contentStrategySchema } from "./contentStrategy";
export { type ThemeType, themeSchema } from "./theme";
export { projectSchema } from "../project";

export {
  BaseRegistry,
  schemaRegistry,
} from "./registries";

export {
  templateSchema,
  templateFileSchema,
  type TemplateFileType,
} from "./template";

export * from "./icons";
