import { Ads } from "@types";
import { Callouts } from "./callouts";
import { Descriptions } from "./descriptions";
import { Headlines } from "./headlines";
import { Keywords } from "./keywords";
import { StructuredSnippetss } from "./structuredSnippetss";

export const promptConfig: Ads.AssetPromptMap = {
    ...Headlines,
    ...Descriptions,
    ...Callouts,
    ...StructuredSnippetss,
    ...Keywords,
} as Ads.AssetPromptMap;
