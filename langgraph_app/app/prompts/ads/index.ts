import { type AdsGraphState } from "@state";
import { type LangGraphRunnableConfig } from "@types";
import { promptBuilder } from "./assets/builder";

// With brainstorm, switching before prompts was very helpful. I presume
// we'll want to build this out more for ads too...
export const chooseAdsPrompt = async(inputState: AdsGraphState, config?: LangGraphRunnableConfig) => {
    return await promptBuilder(inputState, config);
}