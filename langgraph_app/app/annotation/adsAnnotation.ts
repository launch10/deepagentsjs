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
    refresh: Annotation<Ads.RefreshContext | undefined>(),
    headlines: Annotation<Ads.Headline[] | undefined>(),
    descriptions: Annotation<Ads.Description[] | undefined>(),
    callouts: Annotation<Ads.Callout[] | undefined>(),
    structuredSnippets: Annotation<Ads.StructuredSnippets | undefined>(),
    keywords: Annotation<Ads.Keyword[] | undefined>(),
    redirect: Annotation<Ads.RedirectType | undefined>(),
});

// Just a convenience to ensure the annotation matches the state type
type _Assertion = Expect<Equal<AdsGraphState, typeof AdsAnnotation.State>>;