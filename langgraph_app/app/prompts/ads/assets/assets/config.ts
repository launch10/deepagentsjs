import { Ads } from "@types";
import { Callouts } from "./callouts";
import { Descriptions } from "./descriptions";
import { Headlines } from "./headlines";
import { Keywords } from "./keywords";
import { StructuredSnippetss } from "./structuredSnippets";

export const AssetPrompts: Ads.AssetPromptMap = {
    ...Headlines,
    ...Descriptions,
    ...Callouts,
    ...StructuredSnippetss,
    ...Keywords,
} as Ads.AssetPromptMap;
