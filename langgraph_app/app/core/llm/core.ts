import { LLMManagerFactory } from "./factory";
import {
  type LLMAppConfig,
  SonnetConfig,
  HaikuConfig,
  GptOssConfig,
  Gpt5Config,
  Gpt5MiniConfig,
} from "./types";

export const coreLLMConfig: LLMAppConfig = {
  "free": {
    "fast": {
      planning: GptOssConfig,
      writing: GptOssConfig,
      coding: GptOssConfig,
      reasoning: GptOssConfig,
    },
    "slow": {
      planning: GptOssConfig,
      writing: GptOssConfig,
      coding: GptOssConfig,
      reasoning: GptOssConfig,
    },
  },
  "paid": {
    "fast": {
      planning: SonnetConfig,
      writing: Gpt5MiniConfig,
      coding: HaikuConfig,
      reasoning: HaikuConfig,
    },
    "slow": {
      planning: SonnetConfig,
      writing: Gpt5Config,
      coding: SonnetConfig,
      reasoning: SonnetConfig,
    },
  },
};

export const LLMManager = new LLMManagerFactory(coreLLMConfig);