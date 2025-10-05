import { ChatOllama } from "@langchain/ollama";
import { ChatAnthropic } from "@langchain/anthropic"; 
import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { type BaseChatModel } from "@langchain/core/language_models/chat_models";
import { env } from "../env";
import { shasum } from "@ext";
import { assert } from "../assert";

const enum LLMProvider {
  Ollama = 'ollama',
  Anthropic = 'anthropic',
  OpenAI = 'openai',
  Groq = 'groq',
  Google = 'google'
}

export const enum LLMSpeed {
  Fast = 'fast',
  Slow = 'slow'
}

export const enum LLMFree {
  Free = "free",
  Paid = "paid"
}

export const enum LLM {
  // 200k context, 8k completion, ~66tps, $1.00/1M in, $5.00/1M out
  Haiku = "claude-3-5-haiku-latest",

  // 200k context, 8k completion, ~100tps, $5.00/1M in, $15.00/1M out
  Sonnet = "claude-3-5-sonnet-latest",

  // 128k context, 8k completion, ~750tps, $0.05/1M in, $0.08/1M out
  GptOss = "gpt-oss:20b",

  // 1M context, 1M completion, ~unknown tps, $0.70/1M in, $2.10/1M out
  GeminiFlash = "gemini-1.5-flash-latest",

  // 128k context, 8k completion, ~750tps, $0.05/1M in, $0.08/1M out
  LlamaInstant = "llama-3.1-8b-instant",
}
interface LLMConfig {
  provider: LLMProvider;
  model: LLM;
  temperature: number;
  tags?: string[];
  maxTokens: number;
}

const HaikuConfig: LLMConfig = {
  provider: LLMProvider.Anthropic,
  model: LLM.Haiku,
  temperature: 0,
  maxTokens: 180_000,
}

const SonnetConfig: LLMConfig = {
  provider: LLMProvider.Anthropic,
  model: LLM.Sonnet,
  temperature: 0,
  maxTokens: 180_000,
}

const GptOssConfig: LLMConfig = {
  provider: LLMProvider.Ollama,
  model: LLM.GptOss,
  temperature: 0,
  maxTokens: 128_000,
}

const GeminiFlashConfig: LLMConfig = {
  provider: LLMProvider.OpenAI,
  model: LLM.GeminiFlash,
  temperature: 0,
  maxTokens: 1_000_000,
}

const LlamaInstantConfig: LLMConfig = {
  provider: LLMProvider.Groq,
  model: LLM.LlamaInstant,
  temperature: 0,
  maxTokens: 128_000,
}

export const configuredModels: LLMConfig[] = [HaikuConfig, SonnetConfig, GptOssConfig, GeminiFlashConfig, LlamaInstantConfig];
interface LLMsConfig {
  planning: LLMConfig;
  writing: LLMConfig;
  coding: LLMConfig;
  reasoning: LLMConfig;
}

interface LLMAppConfig {
  [key: string]: {
    [key: string]: LLMsConfig
  }
}

export const enum LLMSkill {
  Planning = 'planning',
  Writing = 'writing',
  Coding = 'coding',
  Reasoning = 'reasoning',
}

const freeModel = LLM.GptOss;

const freeSlowConfig: LLMsConfig = {
  planning: GptOssConfig,
  writing: {
    ...GptOssConfig,
    temperature: 0.2,
  },
  coding: GptOssConfig,
  reasoning: GptOssConfig,
};

const freeFastConfig: LLMsConfig = {
  planning: GptOssConfig,
  writing: {
    ...GptOssConfig,
    temperature: 0.2,
  },
  coding: GptOssConfig,
  reasoning: GptOssConfig,
};

const paidSlowConfig: LLMsConfig = {
  planning: HaikuConfig,
  writing: {
    ...SonnetConfig,
    temperature: 0.2,
  },
  coding: SonnetConfig,
  reasoning: SonnetConfig,
};

const paidFastConfig: LLMsConfig = {
  planning: LlamaInstantConfig,
  writing: {
     ...LlamaInstantConfig,
     temperature: 0.2,
  },
  coding: LlamaInstantConfig,
  reasoning: LlamaInstantConfig,
};

export const llmConfig: LLMAppConfig = {
  [LLMFree.Free]: {
    [LLMSpeed.Fast]: freeFastConfig,
    [LLMSpeed.Slow]: freeSlowConfig,
  },
  [LLMFree.Paid]: {
    [LLMSpeed.Fast]: paidFastConfig,
    [LLMSpeed.Slow]: paidSlowConfig,
  },
};

const llmPaid= env.LLM_PAID || LLMFree.Free;
const appLLMConfig = llmConfig[llmPaid as keyof LLMAppConfig];

let llmInstances: Partial<Record<string, BaseChatModel>> = {}; // Key format: "skill-speed"

// Lazy getter for the LLM instance, configurable via environment variables
const LLM_SPEED_DEFAULT = (env.LLM_SPEED === 'fast') ? LLMSpeed.Fast : LLMSpeed.Slow;

export function getLlm(
  llmSkill: LLMSkill,
  llmSpeed: LLMSpeed = LLM_SPEED_DEFAULT
): BaseChatModel {
  const llmPaidKey = (process.env.LLM_PAID === 'paid' ? LLMFree.Paid : LLMFree.Free);
  const cacheKey = `${llmSkill}-${llmSpeed}`;

  // Check if an instance for this skill and speed exists
  if (llmInstances[cacheKey]) {
    return llmInstances[cacheKey]!;
  }

  console.log(`Initializing LLM for skill: ${llmSkill}, speed: ${llmSpeed} using ${llmPaidKey} tier.`);

  // Get the specific config for the requested skill, speed, and determined tier
  const speedConfig = llmConfig[llmPaidKey]?.[llmSpeed];
  if (!speedConfig) {
    throw new Error(`LLM configuration not found for tier '${llmPaidKey}' and speed '${llmSpeed}'.`);
  }
  const config: LLMConfig | undefined = speedConfig[llmSkill];
  if (!config) {
    throw new Error(`LLM configuration not found for skill '${llmSkill}' within tier '${llmPaidKey}' and speed '${llmSpeed}'.`);
  }

  let modelInstance: BaseChatModel;

  // Instantiate based on provider
  switch (config.provider) {
    case LLMProvider.Ollama:
      console.log(`initializing Ollama model ${config.model} | ${config.temperature}`)
      modelInstance = new ChatOllama({
        model: config.model,
        temperature: config.temperature,
      });
      break;
    case LLMProvider.Anthropic:
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicApiKey) {
        throw new Error("Anthropic API key (ANTHROPIC_API_KEY) is missing!");
      }
      modelInstance = new ChatAnthropic({
        apiKey: anthropicApiKey,
        model: config.model,
        temperature: config.temperature,
      });
      break;
    case LLMProvider.Groq:
      const groqApiKey = process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        throw new Error("Groq API key (GROQ_API_KEY) is missing!");
      }
      modelInstance = new ChatGroq({
        apiKey: groqApiKey,
        model: config.model,
        temperature: config.temperature,
      });
      break;
    case LLMProvider.Google:
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey) {
        throw new Error("Google API key (GOOGLE_API_KEY) is missing!");
      }
      // modelInstance = new ChatGoogleGenerativeAI({
      //   cache, // Pass cache if defined and used
      //   apiKey: googleApiKey,
      //   model: config.model,
      //   temperature: config.temperature,
      // });
      break;
    case LLMProvider.OpenAI:
      const openaiApiKey = process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        throw new Error("OpenAI API key (OPENAI_API_KEY) is missing!");
      }
      modelInstance = new ChatOpenAI({
        apiKey: openaiApiKey,
        model: config.model,
        temperature: 1,
      });
      break;
    default:
      // Assert we are never here
      assert(false, `Unsupported LLM provider: ${config.provider}`)
      break;
  }

  llmInstances[cacheKey] = modelInstance;
  return modelInstance;
}

export type CachePolicy = {
    ttl: number;
    keyFunc: (args: unknown[]) => string;
}

export const defaultCachePolicy: CachePolicy = { 
    ttl: 60 * 60 * 24, // 1 day
    keyFunc: (args: unknown[]): string => {
        // Only use the first argument (input) for cache key, ignore config
        const input = args[0];
        const sha = shasum(input);
        return sha;
    }
};