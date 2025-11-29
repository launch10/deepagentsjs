import { type AdsGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@types";
import { promptBuilder } from "./assets/main";

export const chooseAdsPrompt = async(inputState: AdsGraphState, config?: LangGraphRunnableConfig) => {
    return await promptBuilder(inputState, config);
}