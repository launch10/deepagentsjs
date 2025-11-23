export const AssetKinds = ["headlines", "descriptions", "unique_features", "structured_snippets"] as const;
export type AssetKind = typeof AssetKinds[number];

export const PageNames = ["Content", "Highlights"] as const;
export type PageName = typeof PageNames[number];

export interface Asset {
    text: string;
    rejected: boolean;
    locked: boolean;
}
export interface Headline extends Asset {}
export interface Description extends Asset {}
export interface UniqueFeature extends Asset {}

export interface StructuredSnippetCategory extends Asset {}
export interface StructuredSnippetDetail extends Asset {}
export interface StructuredSnippet {
    category: StructuredSnippetCategory;
    details: StructuredSnippetDetail[];
}
export interface Keyword extends Asset {}

export type Page = {
    name: string;
    assets: string[];
}

export type PageMap = {
    [key in PageName]: Page;
}

export const Pages: PageMap = {
    "Content": {
        name: "Content",
        assets: ["headlines", "descriptions"]
    },
    "Highlights": {
        name: "Highlights",
        assets: ["unique_features", "structured_snippets"]
    }
}

export interface AssetPromptConfig {
    prompt: string;
    outputFormat: object;
}

export type AssetPromptMap = Record<AssetKind, AssetPromptConfig>;