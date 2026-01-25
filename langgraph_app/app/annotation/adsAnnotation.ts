import { Annotation } from "@langchain/langgraph";
import { BaseAnnotation } from "./base";
import { Ads, Brainstorm } from "@types";
import type { Equal, Expect, UUIDType, PrimaryKeyType } from "@types";
import type { AdsGraphState } from "@state";
import { createAppBridge } from "@api/middleware";

export const AdsAnnotation = Annotation.Root({
  ...BaseAnnotation.spec,
  projectUUID: Annotation<UUIDType>(),
  websiteId: Annotation<PrimaryKeyType>(),
  campaignId: Annotation<PrimaryKeyType | undefined>(),
  brainstorm: Annotation<Brainstorm.MemoriesType | undefined>(),
  stage: Annotation<Ads.StageName | undefined>(),
  previousStage: Annotation<Ads.StageName | undefined>(),
  refresh: Annotation<Ads.RefreshCommand | undefined>(),
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

// Bridge for streaming frontend - uses createAppBridge for automatic usage tracking
export const AdsBridge = createAppBridge({
  endpoint: "/api/ads/stream",
  stateAnnotation: AdsAnnotation as any,
  messageSchema: Ads.jsonSchema,
  jsonTarget: "state",
  transforms: Ads.StreamingTransforms,
});
