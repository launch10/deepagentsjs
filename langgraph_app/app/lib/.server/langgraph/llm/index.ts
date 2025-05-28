// import { ChatOllama } from "@langchain/ollama";
import { ChatAnthropic } from "@langchain/anthropic"; 
import { ChatGroq } from "@langchain/groq";
// import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { type BaseChatModel } from "@langchain/core/language_models/chat_models";
import { Redis } from "ioredis";
import { RedisCache } from "@langchain/community/caches/ioredis";
import "dotenv/config"; 

const useCache = process.env.USE_CACHE === 'true';
let cache: RedisCache | undefined;
if (useCache) {
  const client = new Redis(process.env.REDIS_URI!);
  cache = new RedisCache(client);
}

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

const enum LLM {
  // 200k context, 8k completion, ~66tps, $1.00/1M in, $5.00/1M out
  Haiku = "claude-3-5-haiku-latest",

  // 200k context, 8k completion, ~100tps, $5.00/1M in, $15.00/1M out
  Sonnet = "claude-3-5-sonnet-latest",

  // Hardware dependent
  QwenCoder = "qwen2.5-coder:7b",
  Llama3 = "llama-3.3-70b",

  O4Mini = "o4-mini-2025-04-16",

  // 128k context, ??? completion, ~275tps, $0.75/1M in, $0.99/1M out
  DeepSeekDistill = "deepseek-r1-distill-llama-70b",
  DeepSeekQwen = "deepseek-r1-distill-qwen-32b",

  // 128k context, 32k completion, ~275tps, $0.59/1M in, $0.79/1M out
  LlamaVersatile = "llama-3.3-70b-versatile",

  // 128k context, 8k completion, ~750tps, $0.05/1M in, $0.08/1M out
  LlamaInstant = "llama-3.1-8b-instant",

  // 1M context, 1M completion, ~unknown ps, $0.70/1M in, $2.10/1M out
  GeminiFlash = "gemini-1.5-flash-latest"
}
interface LLMConfig {
  provider: LLMProvider;
  model: LLM;
  temperature: number;
  tags?: string[];
}
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

const freeSlowConfig: LLMsConfig = {
  planning: {
    provider: LLMProvider.Ollama,
    model: LLM.Llama3,
    temperature: 0,
  },
  writing: {
    provider: LLMProvider.Ollama,
    model: LLM.Llama3,
    temperature: 0.2,
  },
  coding: {
    provider: LLMProvider.Ollama,
    model: LLM.QwenCoder,
    temperature: 0,
  },
  reasoning: {
    provider: LLMProvider.Ollama,
    model: LLM.Llama3,
    temperature: 0,
  },
};

const freeFastConfig: LLMsConfig = {
  planning: {
    provider: LLMProvider.Groq,
    model: LLM.LlamaInstant,
    temperature: 0,
  },
  writing: {
    provider: LLMProvider.Groq,
    model: LLM.LlamaInstant,
    temperature: 0.2,
  },
  coding: {
    provider: LLMProvider.Groq,
    model: LLM.LlamaInstant,
    temperature: 0,
  },
  reasoning: {
    provider: LLMProvider.Groq,
    model: LLM.LlamaInstant,
    temperature: 0,
  },
};

// const paidSlowConfig: LLMsConfig = {
//   planning: {
//     provider: LLMProvider.Anthropic,
//     model: LLM.Haiku,
//     temperature: 0,
//   },
//   writing: {
//     provider: LLMProvider.Anthropic,
//     model: LLM.Haiku,
//     temperature: 0.2,
//   },
//   coding: {
//     provider: LLMProvider.Anthropic,
//     model: LLM.Sonnet,
//     temperature: 0,
//   },
//   reasoning: {
//     provider: LLMProvider.Anthropic,
//     model: LLM.Haiku,
//     temperature: 0,
//   },
// };
const paidSlowConfig: LLMsConfig = {
  planning: {
    provider: LLMProvider.Anthropic,
    model: LLM.Sonnet,
    temperature: 0,
  },
  writing: {
    provider: LLMProvider.Anthropic,
    model: LLM.Sonnet,
    temperature: 0.2,
  },
  coding: {
    provider: LLMProvider.Anthropic,
    model: LLM.Sonnet,
    temperature: 0,
  },
  reasoning: {
    provider: LLMProvider.Anthropic,
    model: LLM.Sonnet,
    temperature: 0,
  },
};

const paidFastConfig: LLMsConfig = {
  planning: {
    provider: LLMProvider.Groq,
    model: LLM.LlamaInstant,
    temperature: 0,
  },
  writing: {
    provider: LLMProvider.Groq,
    model: LLM.LlamaInstant,
    temperature: 0.2,
  },
  coding: {
    provider: LLMProvider.Groq,
    model: LLM.LlamaInstant,
    temperature: 0,
  },
  reasoning: {
    provider: LLMProvider.Groq,
    model: LLM.LlamaInstant,
    temperature: 0,
  },
};

const llmConfig: LLMAppConfig = {
  [LLMFree.Free]: {
    [LLMSpeed.Fast]: freeFastConfig,
    [LLMSpeed.Slow]: freeSlowConfig,
  },
  [LLMFree.Paid]: {
    [LLMSpeed.Fast]: paidFastConfig,
    [LLMSpeed.Slow]: paidSlowConfig,
  },
};

const llmPaid= process.env.LLM_PAID || LLMFree.Free;
const appLLMConfig = llmConfig[llmPaid as keyof LLMAppConfig];

let llmInstances: Partial<Record<string, BaseChatModel>> = {}; // Key format: "skill-speed"

// Lazy getter for the LLM instance, configurable via environment variables
const LLM_SPEED_DEFAULT = (process.env.LLM_SPEED === 'fast') ? LLMSpeed.Fast : LLMSpeed.Slow;

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
      // modelInstance = new ChatOllama({
      //   cache, // Pass cache if defined and used
      //   baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      //   model: config.model,
      //   temperature: config.temperature,
      // });
      break;
    case LLMProvider.Anthropic:
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicApiKey) {
        throw new Error("Anthropic API key (ANTHROPIC_API_KEY) is missing!");
      }
      modelInstance = new ChatAnthropic({
        ...(useCache ? { cache } : {}),
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
        ...(useCache ? { cache } : {}),
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
        ...(useCache ? { cache } : {}),
        apiKey: openaiApiKey,
        model: config.model,
        temperature: 1,
      });
      break;
    default:
      // Exhaustive check
      const _exhaustiveCheck: never = config.provider;
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }

  // Cache the instance
  llmInstances[cacheKey] = modelInstance;
  return modelInstance;
}