import { Ads, type UUIDType, type PrimaryKeyType } from "../types";
import { type CoreGraphState } from "../types/graph";
import { type LanggraphData, type LanggraphUIMessage } from "langgraph-ai-sdk-types";
import type { Simplify } from "type-fest";

export type AdsGraphState = Simplify<CoreGraphState & {
    projectUUID: UUIDType;
    substep: string | undefined; // TODO: Link workflow.yml to type definitions
    headlines: Ads.Headline[] | undefined;
    descriptions: Ads.Description[] | undefined;
    uniqueFeatures: Ads.UniqueFeature[] | undefined;
    structuredSnippets: Ads.StructuredSnippet[] | undefined;
    keywords: Ads.Keyword[] | undefined;
    availableCommands: Ads.CommandName[];
    command: Ads.CommandName | undefined;
    redirect: Ads.RedirectType | undefined;
}>

export type AdsLanggraphData = LanggraphData<
    AdsGraphState,
    typeof Ads.structuredMessageSchemas
>

// Clean, flattened message type for consumer use
export type AdsMessage = Simplify<LanggraphUIMessage<AdsLanggraphData>>;