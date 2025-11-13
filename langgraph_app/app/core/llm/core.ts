import { LLMManagerFactory } from "./factory";
import {
  type LLMAppConfig,
  SonnetConfig,
  HaikuConfig,
  GptOssConfig,
  Gpt5Config,
  Gpt5MiniConfig,
  GroqGptOss120bConfig,
} from "./types";

export const coreLLMConfig: LLMAppConfig = {
  "free": {
    "blazing": {
      planning: GptOssConfig,
      writing: GptOssConfig,
      coding: GptOssConfig,
      reasoning: GptOssConfig,
    },
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
    "blazing": {
      planning: GroqGptOss120bConfig,
      writing: GroqGptOss120bConfig,
      coding: GroqGptOss120bConfig,
      reasoning: GroqGptOss120bConfig,
    },
    "fast": {
      planning: SonnetConfig,
      writing: HaikuConfig,
      coding: HaikuConfig,
      reasoning: HaikuConfig,
    },
    "slow": {
      planning: SonnetConfig,
      writing: HaikuConfig,
      coding: SonnetConfig,
      reasoning: SonnetConfig,
    },
  },
};

export const LLMManager = new LLMManagerFactory(coreLLMConfig);