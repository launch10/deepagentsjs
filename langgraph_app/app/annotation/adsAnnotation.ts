import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Ads, Brainstorm } from "@types";
import type { Equal, Expect, UUIDType, PrimaryKeyType } from "@types";
import type { AdsGraphState } from "@state";
import { createBridge } from "langgraph-ai-sdk";

export const AdsAnnotation = Annotation.Root({
    ...BaseAnnotation.spec,
    projectUUID: Annotation<UUIDType>(),
    websiteId: Annotation<PrimaryKeyType>(),
    campaignId: Annotation<PrimaryKeyType | undefined>(),
    brainstorm: Annotation<Brainstorm.MemoriesType | undefined>(),
    stage: Annotation<Ads.StageName | undefined>(),
    refresh: Annotation<Ads.RefreshContext | undefined>(),
    headlines: Annotation<Ads.Headline[] | undefined>(),
    descriptions: Annotation<Ads.Description[] | undefined>(),
    callouts: Annotation<Ads.Callout[] | undefined>(),
    structuredSnippets: Annotation<Ads.StructuredSnippets | undefined>(),
    keywords: Annotation<Ads.Keyword[] | undefined>(),
    redirect: Annotation<Ads.RedirectType | undefined>(),
    hasStartedStep: Annotation<Ads.HasStartedStep | undefined>(),
});

// Just a convenience to ensure the annotation matches the state type
type _Assertion = Expect<Equal<AdsGraphState, typeof AdsAnnotation.State>>;

const decorateAssetReducer = (streamed: string[] | undefined, current: Ads.Asset[] | undefined) => {
    const existing = current ?? [];
    const existingTexts = new Set(existing.map(h => h.text));
    const newAssets = (streamed || [])
        .filter(text => !existingTexts.has(text))
        .map(text => ({ text, rejected: false, locked: false }));
    return [...existing, ...newAssets];
}

type StreamedSnippet = { category: string; details: string[] };

export const AdsBridge = createBridge({
    endpoint: "/api/ads/stream",
    stateAnnotation: AdsAnnotation,
    messageSchema: Ads.jsonSchema,
    jsonTarget: "state",
    reducers: {
        headlines: decorateAssetReducer,
        descriptions: decorateAssetReducer,
        callouts: decorateAssetReducer,
        keywords: decorateAssetReducer,
        structuredSnippets: (streamed: StreamedSnippet | undefined, current: Ads.StructuredSnippets | undefined): Ads.StructuredSnippets => {
            const existing = current ?? {category: "", details: []} satisfies Ads.StructuredSnippets;
            const existingTexts = new Set(existing.details.map(h => h.text));
            const newAssets = (streamed || { category: "", details: [] })
                .details
                .filter(text => !existingTexts.has(text))
                .map(text => ({ text, rejected: false, locked: false }));
            return { ...existing, details: [...existing.details, ...newAssets] };
        },
    }
})