import { z } from "zod";
import { uuidSchema } from "../core";
import * as Workflow from "../workflow";

export const AssetKinds = [
  "headlines",
  "descriptions",
  "callouts",
  "structuredSnippets",
  "keywords",
] as const;
export type AssetKind = (typeof AssetKinds)[number];

// Ads only uses ad campaign substeps, not website substeps
export const StageNames = Workflow.AdCampaignSubstepNames;
export type StageName = Workflow.AdCampaignSubstepName;

export const ContentStages = ["content", "highlights", "keywords"] as const;
export type ContentStage = (typeof ContentStages)[number];

export const NonContentStages = StageNames.filter(
  (stage) => !ContentStages.includes(stage as ContentStage)
) as Exclude<StageName, ContentStage>[];
export type NonContentStage = (typeof NonContentStages)[number];

const ContentStagesSet = new Set<string>(ContentStages);

export const isContentStage = (stage: StageName): stage is ContentStage => {
  return ContentStagesSet.has(stage);
};

export const AssetSchema = z.object({
  id: uuidSchema,
  text: z.string(),
  rejected: z.boolean(),
  locked: z.boolean(),
});

export type Asset = z.infer<typeof AssetSchema>;
export interface Headline extends Asset {}
export interface Description extends Asset {}
export interface Callout extends Asset {}
export interface Keyword extends Asset {}
export interface StructuredSnippetsCategory extends Asset {}
export interface StructuredSnippetsDetail extends Asset {}

export const StructuredSnippetCategoryKeys = [
  "amenities",
  "brands",
  "courses",
  "degree_programs",
  "destinations",
  "featured_hotels",
  "insurance_coverage",
  "models",
  "neighborhoods",
  "services",
  "shows",
  "styles",
  "types",
] as const;

export type StructuredSnippetCategoryKey = (typeof StructuredSnippetCategoryKeys)[number];

export const StructuredSnippetCategoryNames = [
  "Amenities",
  "Brands",
  "Courses",
  "Degree programs",
  "Destinations",
  "Featured hotels",
  "Insurance coverage",
  "Models",
  "Neighborhoods",
  "Service catalog",
  "Shows",
  "Styles",
  "Types",
] as const;
export type StructuredSnippetCategoryName = (typeof StructuredSnippetCategoryNames)[number];
export interface StructuredSnippetCategoryDefinition {
  key: StructuredSnippetCategoryName;
  definition?: string;
  examples: string;
}

export const StructuredSnippetCategories: Record<
  StructuredSnippetCategoryKey,
  StructuredSnippetCategoryDefinition
> = {
  brands: {
    key: "Brands",
    definition: "Company or product line names",
    examples: "Brands: Nest, Nexus, Chromebook",
  } as const,
  amenities: {
    key: "Amenities",
    definition: "Desirable or useful features or facilities of a building or place",
    examples: "Amenities: Ski Storage, Swimming Pool, Restaurant",
  } as const,
  styles: {
    key: "Styles",
    definition: "Variants of a product",
    examples: "Styles: Wingback, Button Tufted, French Country, Swivel, Nailhead, Scalloped",
  } as const,
  types: {
    key: "Types",
    definition: "Categories or variants of a product or service",
    examples: "Types: LED, Incandescent, Halogen, Fluorescent, Metal Halide",
  } as const,
  destinations: {
    key: "Destinations",
    definition: "Geographic entities - cities, states, countries, etc.",
    examples: "Destinations: Las Vegas, New York, Tokyo, Rome, Cancun, Paris",
  } as const,
  services: {
    key: "Service catalog",
    definition: "Services offered",
    examples: "Services: Oil change, Smog check, tire alignment",
  } as const,
  courses: {
    key: "Courses",
    definition: "Educational offerings",
    examples: "Courses: Linear Algebra, Creative Writing, Data Structures",
  } as const,
  neighborhoods: {
    key: "Neighborhoods",
    examples: "Neighborhoods: Downtown, Hayes Valley, Mission, Excelsior",
  } as const,
  shows: {
    key: "Shows",
    definition: "TV shows or theater",
    examples: "Shows: The Voyage, Knights, American Dancer",
  } as const,
  insurance_coverage: {
    key: "Insurance coverage",
    definition: "Types of coverage offered by insurance companies",
    examples: "Coverage: Liability, Collision, Comprehensive",
  } as const,
  degree_programs: {
    key: "Degree programs",
    definition: "Major subjects of study at an educational institution",
    examples: "Degree programs: Accounting, Biology, Psychology",
  } as const,
  featured_hotels: {
    key: "Featured hotels",
    definition: "Hotel names",
    examples: "Featured hotels: Luxury Inn, Alpine Lodge, Lakeside Hotel",
  } as const,
  models: {
    key: "Models",
    definition: "Car product lines",
    examples: "Models: Corolla, Camry, Prius",
  } as const,
} as const;

export const StructuredSnippetsSchema = z.object({
  category: z.enum(StructuredSnippetCategoryKeys),
  details: z.array(AssetSchema),
});

// Real character limits for final assets (what Google actually accepts)
export const AssetLengths: Record<AssetKind, number> = {
  headlines: 30,
  descriptions: 90,
  callouts: 25,
  structuredSnippets: 25,
  keywords: 90,
} as const;

// Use these to avoid LLMs exceeding character limits during generation (ensures output stays within limits)
export const FakeAssetLengths: Record<AssetKind, number> = {
  headlines: 20,
  descriptions: 70,
  callouts: 15,
  structuredSnippets: 15,
  keywords: 70,
} as const;

export interface AssetLimit {
  min: number;
  max: number;
}

export const AssetLimits: Record<AssetKind, AssetLimit> = {
  headlines: { min: 3, max: 15 },
  descriptions: { min: 2, max: 4 },
  callouts: { min: 2, max: 10 },
  structuredSnippets: { min: 3, max: 10 },
  keywords: { min: 1, max: 20 },
};

export const limitAssets = <T>(assets: T[], kind: AssetKind): T[] => {
  return assets.slice(0, AssetLimits[kind].max);
};

export type StructuredSnippets = z.infer<typeof StructuredSnippetsSchema>;

// LLM output schemas with character limits
export const headlineSchema = AssetSchema.extend({
  text: z
    .string()
    .min(1, "Headlines cannot be empty")
    .max(AssetLengths.headlines, `Headlines must be ${AssetLengths.headlines} characters or less`),
});
export const HeadlinesOutputSchema = z.object({
  headlines: z.array(headlineSchema),
});
export type HeadlinesOutput = z.infer<typeof HeadlinesOutputSchema>;

export const descriptionSchema = AssetSchema.extend({
  text: z
    .string()
    .min(1, "Descriptions cannot be empty")
    .max(
      AssetLengths.descriptions,
      `Descriptions must be ${AssetLengths.descriptions} characters or less`
    ),
});
export const DescriptionsOutputSchema = z.object({
  descriptions: z.array(descriptionSchema),
});
export type DescriptionsOutput = z.infer<typeof DescriptionsOutputSchema>;

export const calloutsSchema = AssetSchema.extend({
  text: z
    .string()
    .min(1, "Callouts cannot be empty")
    .max(AssetLengths.callouts, `Callouts must be ${AssetLengths.callouts} characters or less`),
});
export const CalloutsOutputSchema = z.object({
  callouts: z.array(calloutsSchema),
});
export type CalloutsOutput = z.infer<typeof CalloutsOutputSchema>;

const detailsSchema = AssetSchema.extend({
  text: z
    .string()
    .min(1, "Snippet details cannot be empty")
    .max(
      AssetLengths.structuredSnippets,
      `Snippet details must be ${AssetLengths.structuredSnippets} characters or less`
    ),
});
export const StructuredSnippetsOutputSchema = z.object({
  category: z.enum(StructuredSnippetCategoryKeys),
  details: z.array(detailsSchema),
});
export type StructuredSnippetsOutput = z.infer<typeof StructuredSnippetsOutputSchema>;

export const KeywordsOutputSchema = z.object({
  keywords: z.array(z.string()),
});
export type KeywordsOutput = z.infer<typeof KeywordsOutputSchema>;

// This is what the LLM will return
export const StreamedAssetSchema = z.array(z.string());
export type StreamedAsset = z.infer<typeof StreamedAssetSchema>;
export const StreamedSnippetsSchema = z.object({
  category: z.enum(StructuredSnippetCategoryKeys),
  details: StreamedAssetSchema,
});
export type StreamedSnippets = z.infer<typeof StreamedSnippetsSchema>;

export type Stage = {
  stage: StageName;
  assets: AssetKind[];
};

export type StageMap = {
  [key in StageName]: Stage;
};

export const Stages: Partial<StageMap> = {
  content: {
    stage: "content",
    assets: ["headlines", "descriptions"],
  },
  highlights: {
    stage: "highlights",
    assets: ["callouts", "structuredSnippets"],
  },
  keywords: {
    stage: "keywords",
    assets: ["keywords"],
  },
  settings: {
    stage: "settings",
    assets: [],
  },
  launch: {
    stage: "launch",
    assets: [],
  },
  review: {
    stage: "review",
    assets: [],
  },
};

export const assetsForStage = (stage: StageName): AssetKind[] => {
  return Stages[stage]?.assets ?? [];
};

type PromptFn = (state: any, config?: any) => Promise<string>;
type OutputFormatFn = (state: any, config?: any) => Promise<string[] | object>;
type SchemaFn = (state: any, config?: any) => z.ZodSchema;
export interface AssetPromptConfig {
  prompt: PromptFn;
  outputFormat: OutputFormatFn;
  schema: SchemaFn;
}

export type AssetPromptMap = Record<AssetKind, AssetPromptConfig>;

export const RefreshContextSchema = z.object({
  asset: z.enum(AssetKinds),
  nVariants: z.number().min(1).max(10),
});

export type RefreshContext = z.infer<typeof RefreshContextSchema>;

export const RefreshCommandSchema = z.array(RefreshContextSchema);

export type RefreshCommand = z.infer<typeof RefreshCommandSchema>;

export type HasStartedStep = {
  [K in StageName]?: boolean;
};

export const DefaultNumAssets: Record<AssetKind, number> = {
  headlines: 6,
  descriptions: 4,
  callouts: 6,
  structuredSnippets: 3,
  keywords: 8,
};

export const refreshAllCommand = (stage: StageName): RefreshCommand => {
  const assetsToRefresh = assetsForStage(stage);
  return assetsToRefresh.map((asset) => ({
    asset: asset,
    nVariants: DefaultNumAssets[asset],
  }));
};

export const getNVariantsForAsset = (
  refresh: RefreshCommand | undefined,
  asset: AssetKind
): number | undefined => {
  if (!refresh?.length) return undefined;
  const found = refresh.find((r) => r.asset === asset);
  return found?.nVariants;
};

export const diffAssets = (original: Asset[], updated: Asset[]): Asset[] => {
  const originalTexts = new Set(original.map((a) => a.text));
  return updated.filter((a) => !originalTexts.has(a.text));
};

export type Assets = {
  headlines: Asset[];
  descriptions: Asset[];
  callouts: Asset[];
  structuredSnippets: StructuredSnippets;
  keywords: Asset[];
};

export const stageLoadedSuccessfully = (state: Partial<Assets>, stage: StageName): boolean => {
  const assets = assetsForStage(stage);
  return assets.every((asset) => {
    if (asset === "structuredSnippets") {
      return state[asset]?.details.length;
    }
    return state[asset]?.length;
  });
};
