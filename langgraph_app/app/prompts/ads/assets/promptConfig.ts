import { Ads } from "@types";
import { Callouts } from "./callouts";
import { Descriptions } from "./descriptions";
import { Headlines } from "./headlines";
import { Keywords } from "./keywords";
import { StructuredSnippets } from "./structuredSnippets";

export const promptConfig: Ads.AssetPromptMap = {
    ...Callouts,
    ...Descriptions,
    ...Headlines,
    ...Keywords,
    ...StructuredSnippets,
} as Ads.AssetPromptMap;
