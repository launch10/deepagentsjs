import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Ads, Brainstorm } from "@types";
import type { Equal, Expect, UUIDType, PrimaryKeyType } from "@types";
import type { AdsGraphState } from "@state";

export const AdsAnnotation = Annotation.Root({
    ...BaseAnnotation.spec,
    projectUUID: Annotation<UUIDType>(),
    websiteId: Annotation<PrimaryKeyType>(),
    brainstorm: Annotation<Brainstorm.MemoriesType | undefined>(),
    stage: Annotation<Ads.StageName | undefined>(),
    refreshContext: Annotation<Ads.AssetKind[] | undefined>(),
    headlines: Annotation<Ads.Headline[] | undefined>(),
    descriptions: Annotation<Ads.Description[] | undefined>(),
    uniqueFeatures: Annotation<Ads.UniqueFeature[] | undefined>(),
    structuredSnippets: Annotation<Ads.StructuredSnippet[] | undefined>(),
    keywords: Annotation<Ads.Keyword[] | undefined>(),
    availableCommands: Annotation<Ads.CommandName[]>({
        default: () => [],
        reducer: (current, next) => [...next]
    }),
    command: Annotation<Ads.CommandName | undefined>(),
    redirect: Annotation<Ads.RedirectType | undefined>(),
});

// Just a convenience to ensure the annotation matches the state type
type _Assertion = Expect<Equal<AdsGraphState, typeof AdsAnnotation.State>>;