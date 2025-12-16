import { Ads, Brainstorm, type UUIDType, type PrimaryKeyType } from "../types";
import { type CoreGraphState } from "../types/graph";
import { type BridgeType } from "langgraph-ai-sdk-types";
import type { Simplify } from "type-fest";

export type AdsGraphState = Simplify<CoreGraphState & {
    projectUUID: UUIDType;
    websiteId: PrimaryKeyType;
    campaignId: PrimaryKeyType | undefined;
    brainstorm: Brainstorm.MemoriesType | undefined;
    stage: Ads.StageName | undefined;
    previousStage: Ads.StageName | undefined;
    refresh: Ads.RefreshCommand | undefined;
    headlines: Ads.Headline[] | undefined;
    descriptions: Ads.Description[] | undefined;
    callouts: Ads.Callout[] | undefined;
    structuredSnippets: Ads.StructuredSnippets | undefined;
    keywords: Ads.Keyword[] | undefined;
    redirect: Ads.RedirectType | undefined;
    hasStartedStep: Ads.HasStartedStep | undefined;
}>

export type AdsBridgeType = BridgeType<
    AdsGraphState,
    typeof Ads.jsonSchema
>