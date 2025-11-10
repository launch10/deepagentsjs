// Clean barrel exports using ES modules
export * as Website from "./website";
export { Task, CodeTask, codeTaskSchema, taskHistorySchema, type TaskHistoryType, todoSchema, todoListSchema } from "./task";
export { Template } from "./website";
export * as Project from "./project";

// Individual exports for things that don't need namespacing
export * from "./core";
export * from "./website/template";
export * from "./website/errors";

// Re-export project at top level since it's simple
export * from "./project";

// Convenience type aliases for backward compatibility
export type { 
  FileType,
  FileMap,
  FileSpecType,
  PageType,
  PagePlanType,
  ComponentType,
  ThemeType,
  ComponentContentPlanType,
  ContentStrategyType,
  ComponentOverviewPromptType,
  WebsiteType,
  ComponentOverviewType,
  ThemeVariantType,
  ThemeVariantDataType,
  WebsiteFileType,
  CodeFileType,
  HeroType,
  BenefitsType,
  CtaType,
  CustomType,
  FaqType,
  FeaturesType,
  HowItWorksType,
  PricingType,
  SocialProofType,
  TeamType,
  TestimonialsType,
  NavType,
  FooterType,
  IconEmbeddingType,
  TemplateFileType,
  BackgroundColorKey,
} from "./website";

export type {
  TaskType,
  CodeTaskType,
  TodoType,
  TodoListType
} from "./task";

export type ProjectType = import("./project").Type;

// Export all enums from website for convenience
export { 
  FileTypeEnum,
  SectionTypeEnum,
  PageTypeEnum,
  LanguageEnum,
  StyleTypeEnum,
  LayoutTypeEnum,
  ComponentTypeEnum,
  BackgroundColorEnum,
  ConfigTypeEnum,
} from "./website";

// Export task enums
export { TypeEnum as TaskTypeEnum, ActionEnum, StatusEnum } from "./task";

// Type for completed tasks
export type CompletedCodeTask = import("./task").CodeTaskType & {
  status: import("./task").StatusEnum.COMPLETED;
  results: import("./task/codeTask").ResultType;
};

// Export schemas for convenience
export { 
  getComponentPlanSchema,
  getComponentTheme,
  componentSchema,
  projectSchema,
  themeSchema,
  pageSchema,
  websiteSchema,
  contentStrategySchema,
  fileSpecSchema,
  fileSchema, 
  websiteFileSchema,
  codeFileSchema,
  componentOverviewSchema, 
  componentTypeSchema, 
  iconEmbeddingSchema,
  CodeFileSourceEnum,
  BaseRegistry,
  schemaRegistry,
  templateSchema,
  templateFileSchema,
  themeVariantSchema,
  backgroundColorKey,
} from "./website";

export * from "./guards";

export * as Brainstorm from "./brainstorm";
export * as Graphs from "./graphs";

export * from "./graph";
export * from "./message";