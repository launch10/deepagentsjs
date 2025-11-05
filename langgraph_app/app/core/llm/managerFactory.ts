import { type BaseChatModel } from "@langchain/core/language_models/chat_models";
import { env } from "@app";
import { LLMTestResponder } from "./test";
import { ChatAnthropic } from "@langchain/anthropic"; 
import { ChatOllama } from "@langchain/ollama";
import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { 
    type LLMAppConfig, 
    type LLMConfig, 
    type LLMSkill, 
    type LLMSpeed, 
    type LLMCost, 
    type LLMName, 
    type IAPIConfig,
    type ILocalConfig,
    Models 
} from "./types";

export class LLMManagerFactory {
  mode: "test" | "regular" = "regular";
  private config: LLMAppConfig;
  private llmCache: Partial<Record<string, BaseChatModel>>;

  constructor(config: LLMAppConfig) {
    this.llmCache = {};
    this.config = config;
  }

  reset() {
    this.mode = "regular";
  }

  testMode() {
    if (env.NODE_ENV === "test") {
      this.mode = "test";
    } else {
      throw new Error("LLMManager.testMode() can only be called in test mode!");
    }
  }

  llmIsConfigured(name: LLMName): boolean {
    let model = Models[name]
    if (!model) {
        return false;
    }
    
    if (model.type == "api") {
        return 'apiKey' in model && !!model.apiKey && typeof model.apiKey === 'string' && model.apiKey.length > 0;
    }

    return true;
  }

  apiConfigured(config: LLMConfig): config is IAPIConfig {
    const name = config.model;
    return Models[name].type === "api" && !!Models[name].apiKey && typeof Models[name].apiKey === 'string' && Models[name].apiKey.length > 0;
  }

  localConfigured(config: LLMConfig): config is ILocalConfig {
    const name = config.model;
    return Models[name].type === "local";
  }

  getModel(llmSkill: LLMSkill, llmSpeed: LLMSpeed, llmCost: LLMCost) {
    // Get the specific config for the requested skill, speed, and tier
    const speedConfig = this.config[llmCost]?.[llmSpeed];
    if (!speedConfig) {
      throw new Error(`LLM configuration not found for tier '${llmCost}' and speed '${llmSpeed}'.`);
    }

    const config: LLMConfig | undefined = speedConfig[llmSkill];
    if (!config) {
      throw new Error(`LLM configuration not found for skill '${llmSkill}' within tier '${llmCost}' and speed '${llmSpeed}'.`);
    }

    let modelInstance: BaseChatModel;

    // Instantiate based on provider
    switch (config.provider) {
      case "anthropic":
        if (!this.apiConfigured(config)) {
          throw new Error("Anthropic API key (ANTHROPIC_API_KEY) is missing!");
        }
        modelInstance = new ChatAnthropic({
          apiKey: config.apiKey,
          model: config.modelCard,
          temperature: config.temperature,
        });
        break;
      case "openai":
        if (!this.apiConfigured(config)) {
          throw new Error("OpenAI API key (OPENAI_API_KEY) is missing!");
        }
        modelInstance = new ChatOpenAI({
          apiKey: config.apiKey,
          model: config.modelCard,
          temperature: config.temperature,
        });
        break;
      case "ollama":
        if (!this.localConfigured(config)) {
          throw new Error("Ollama model not configured!");
        }
        modelInstance = new ChatOllama({
          model: config.modelCard,
          temperature: config.temperature,
        });
        break;
      case "groq":
        if (!this.apiConfigured(config)) {
          throw new Error("Groq API key (GROQ_API_KEY) is missing!");
        }
        modelInstance = new ChatGroq({
          apiKey: config.apiKey,
          model: config.modelCard,
          temperature: config.temperature,
        });
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }

    return modelInstance;
  }

  useTest() {
    return this.mode === "test";
  }

  configureFixtures(...args: Parameters<typeof LLMTestResponder.configure>) {
    this.testMode()
    LLMTestResponder.configure(...args);
  }

  resetTestResponses() {
    this.reset();
    LLMTestResponder.reset();
  }

  get(llmSkill: LLMSkill, llmSpeed: LLMSpeed, llmCost: LLMCost): BaseChatModel {
    console.log(`use test???`)
    console.log(this.useTest())
    if (this.useTest()) {
      return LLMTestResponder.get();
    }

    const cacheKey = `${llmSkill}-${llmSpeed}-${llmCost}`;
    if (cacheKey in this.llmCache) {
      return this.llmCache[cacheKey]!;
    }
    const result = this.getModel(llmSkill, llmSpeed, llmCost);
    this.llmCache[cacheKey] = result;
    return result;
  }
}