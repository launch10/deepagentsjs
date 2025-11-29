import { z } from "zod";
import { 
    LaunchAdCampaignSubsteps
 } from "../workflow";

export const AssetKinds = ["headlines", "descriptions", "callouts", "structured_snippets", "keywords"] as const;
export type AssetKind = typeof AssetKinds[number];

export const StageNames = LaunchAdCampaignSubsteps;
export type StageName = typeof StageNames[number];

export const AssetSchema = z.object({
    text: z.string(),
    rejected: z.boolean(),
    locked: z.boolean()
});

export type Asset = z.infer<typeof AssetSchema>;
export interface Headline extends Asset {}
export interface Description extends Asset {}
export interface Callout extends Asset {}
export interface StructuredSnippetCategory extends Asset {}
export interface StructuredSnippetDetail extends Asset {}

export const StructuredSnippetSchema = z.object({
    category: AssetSchema,
    details: z.array(AssetSchema)
});
export type StructuredSnippet = z.infer<typeof StructuredSnippetSchema>;
export interface Keyword extends Asset {}

export type Stage = {
    stage: StageName;
    assets: AssetKind[];
}

export type StageMap = {
    [key in StageName]: Stage;
}

export const Stages: StageMap = {
    "content": {
        stage: "content",
        assets: ["headlines", "descriptions"]
    },
    "highlights": {
        stage: "highlights",
        assets: ["callouts", "structured_snippets"]
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