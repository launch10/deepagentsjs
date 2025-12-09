import { type AdsGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@types";
import { promptBuilder } from "./assets/main";
import { Ads } from "@types";
import { helpPrompt } from "./helpPrompt";

export const chooseAdsPrompt = async (state: AdsGraphState, config: LangGraphRunnableConfig) => {
  if (Ads.isContentStage(state.stage!)) {
    return await promptBuilder(state, config);
  }

  return await helpPrompt(state, config);
};

export * from "./pseudoMessages";
