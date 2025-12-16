import { z } from "zod";
import { uuidSchema } from "../core";
import * as  Workflow from "../workflow";

export const AssetKinds = ["headlines", "descriptions", "callouts", "structuredSnippets", "keywords"] as const;
export type AssetKind = typeof AssetKinds[number];

export const StageNames = Workflow.SubstepNames;
export type StageName = typeof StageNames[number];

export const ContentStages = ["content", "highlights", "keywords"] as const;
export type ContentStage = typeof ContentStages[number];

export const NonContentStages = StageNames.filter(stage => !ContentStages.includes(stage as ContentStage)) as Exclude<StageName, ContentStage>[];
export type NonContentStage = typeof NonContentStages[number];

const ContentStagesSet = new Set<string>(ContentStages);

export const isContentStage = (stage: StageName): stage is
ContentStage => {
    return ContentStagesSet.has(stage);
};

export const AssetSchema = z.object({
    id: uuidSchema,
    text: z.string(),
    rejected: z.boolean(),
    locked: z.boolean()
});

export type Asset = z.infer<typeof AssetSchema>;
export interface Headline extends Asset {}
export interface Description extends Asset {}
export interface Callout extends Asset {}
export interface Keyword extends Asset {}
export interface StructuredSnippetsCategory extends Asset {}
export interface StructuredSnippetsDetail extends Asset {}

export const StructuredSnippetCategoryKeys = [
  "brands",
  "amenities",
  "styles",
  "types",
  "destinations",
  "services",
  "courses",
  "neighborhoods",
  "shows",
  "insurance_coverage",
  "degree_programs",
  "featured_hotels",
  "models",
] as const;

export type StructuredSnippetCategoryKey = typeof StructuredSnippetCategoryKeys[number];

export interface StructuredSnippetCategoryDefinition {
  key: string;
  definition?: string;
  examples: string;
}

export const StructuredSnippetCategories: Record<StructuredSnippetCategoryKey, StructuredSnippetCategoryDefinition> = {
  brands: {
    key: "Brands",
    definition: "Company or product line names",
    examples: "Brands: Nest, Nexus, Chromebook",
  },
  amenities: {
    key: "Amenities",
    definition: "Desirable or useful features or facilities of a building or place",
    examples: "Amenities: Ski Storage, Swimming Pool, Restaurant",
  },
  styles: {
    key: "Styles",
    definition: "Variants of a product",
    examples: "Styles: Wingback, Button Tufted, French Country, Swivel, Nailhead, Scalloped",
  },
  types: {
    key: "Types",
    definition: "Categories or variants of a product or service",
    examples: "Types: LED, Incandescent, Halogen, Fluorescent, Metal Halide",
  },
  destinations: {
    key: "Destinations",
    definition: "Geographic entities - cities, states, countries, etc.",
    examples: "Destinations: Las Vegas, New York, Tokyo, Rome, Cancun, Paris",
  },
  services: {
    key: "Services",
    definition: "Services offered",
    examples: "Services: Oil change, Smog check, tire alignment",
  },
  courses: {
    key: "Courses",
    definition: "Educational offerings",
    examples: "Courses: Linear Algebra, Creative Writing, Data Structures",
  },
  neighborhoods: {
    key: "Neighborhoods",
    examples: "Neighborhoods: Downtown, Hayes Valley, Mission, Excelsior",
  },
  shows: {
    key: "Shows",
    definition: "TV shows or theater",
    examples: "Shows: The Voyage, Knights, American Dancer",
  },
  insurance_coverage: {
    key: "Insurance coverage",
    definition: "Types of coverage offered by insurance companies",
    examples: "Coverage: Liability, Collision, Comprehensive",
  },
  degree_programs: {
    key: "Degree programs",
    definition: "Major subjects of study at an educational institution",
    examples: "Degree programs: Accounting, Biology, Psychology",
  },
  featured_hotels: {
    key: "Featured hotels",
    definition: "Hotel names",
    examples: "Featured hotels: Luxury Inn, Alpine Lodge, Lakeside Hotel",
  },
  models: {
    key: "Models",
    definition: "Car product lines",
    examples: "Models: Corolla, Camry, Prius",
  },
};

export const StructuredSnippetsSchema = z.object({
    category: z.string(),
    details: z.array(AssetSchema)
});
export type StructuredSnippets = z.infer<typeof StructuredSnippetsSchema>;

// This is what the LLM will return
export const StreamedAssetSchema = z.array(z.string());
export type StreamedAsset = z.infer<typeof StreamedAssetSchema>;
export const StreamedSnippetsSchema = z.object({
    category: z.string(),
    details: StreamedAssetSchema
}); 
export type StreamedSnippets = z.infer<typeof StreamedSnippetsSchema>;

export type Stage = {
    stage: StageName;
    assets: AssetKind[];
}

export type StageMap = {
    [key in StageName]: Stage;
}

export const Stages: Partial<StageMap> = {
    "content": {
        stage: "content",
        assets: ["headlines", "descriptions"]
    },
    "highlights": {
        stage: "highlights",
        assets: ["callouts", "structuredSnippets"]
    },
    "keywords": {
        stage: "keywords",
        assets: ["keywords"]
    },
    "settings": {
        stage: "settings",
        assets: []
    },
    "launch": {
        stage: "launch",
        assets: []
    },
    "review": {
        stage: "review",
        assets: []
    }
};

export const assetsForStage = (stage: StageName): AssetKind[] => {
    return Stages[stage]?.assets ?? [];
};

type PromptFn = (state: any, config?: any) => Promise<string>;
type OutputFormatFn = (state: any, config?: any) => Promise<string[] | object>;
export interface AssetPromptConfig {
    prompt: PromptFn;
    outputFormat: OutputFormatFn;
}

export type AssetPromptMap = Record<AssetKind, AssetPromptConfig>;

export const RefreshContextSchema = z.object({
    asset: z.enum(AssetKinds),
    nVariants: z.number().min(1).max(10)
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
    keywords: 8
};

export const refreshAllCommand = (stage: StageName): RefreshCommand => {
    const assetsToRefresh = assetsForStage(stage);
    return assetsToRefresh.map((asset) => ({
        asset: asset,
        nVariants: DefaultNumAssets[asset],
    }));
}

export const getNVariantsForAsset = (refresh: RefreshCommand | undefined, asset: AssetKind): number | undefined => {
    if (!refresh?.length) return undefined;
    const found = refresh.find((r) => r.asset === asset);
    return found?.nVariants;
}

export const diffAssets = (original: Asset[], updated: Asset[]): Asset[] => {
    const originalTexts = new Set(original.map(a => a.text));
    return updated.filter(a => !originalTexts.has(a.text));
};

export type Assets = {
    headlines: Asset[];
    descriptions: Asset[];
    callouts: Asset[];
    structuredSnippets: StructuredSnippets;
    keywords: Asset[];
}

export const stageLoadedSuccessfully = (state: Partial<Assets>, stage: StageName): boolean => {
    const assets = assetsForStage(stage);
    return assets.every((asset) => {
        if (asset === "structuredSnippets") {
            return state[asset]?.details.length;
        }
        return state[asset]?.length;
    })
}
