import { AIMessage, SystemMessage, HumanMessage } from "@langchain/core/messages";
import type { LLMResult } from "@langchain/core/outputs";

/**
 * Mock usage metadata matching Anthropic's response structure.
 * Based on actual API responses captured via explore-usage-metadata.ts
 */
export const MOCK_ANTHROPIC_USAGE_METADATA = {
  input_tokens: 1234,
  output_tokens: 567,
  cache_creation_input_tokens: 100,
  cache_read_input_tokens: 50,
};

/**
 * Mock response metadata for Anthropic models
 */
export const MOCK_ANTHROPIC_RESPONSE_METADATA = {
  model: "claude-haiku-4-5-20251001",
  stop_reason: "end_turn",
};

/**
 * Mock usage metadata matching OpenAI's response structure.
 */
export const MOCK_OPENAI_USAGE_METADATA = {
  input_tokens: 2345,
  output_tokens: 890,
  output_token_details: {
    reasoning: 200,
  },
};

/**
 * Mock response metadata for OpenAI models
 */
export const MOCK_OPENAI_RESPONSE_METADATA = {
  model_name: "gpt-4.1-mini-2025-04-14",
  finish_reason: "stop",
};

/**
 * Create an AIMessage with Anthropic-style usage metadata
 */
export function createAnthropicAIMessage(
  content: string = "This is a test response",
  overrides: Partial<typeof MOCK_ANTHROPIC_USAGE_METADATA> = {}
): AIMessage {
  const message = new AIMessage(content);
  (message as any).usage_metadata = {
    ...MOCK_ANTHROPIC_USAGE_METADATA,
    ...overrides,
  };
  (message as any).response_metadata = MOCK_ANTHROPIC_RESPONSE_METADATA;
  return message;
}

/**
 * Create an AIMessage with OpenAI-style usage metadata
 */
export function createOpenAIAIMessage(
  content: string = "This is a test response",
  overrides: Partial<typeof MOCK_OPENAI_USAGE_METADATA> = {}
): AIMessage {
  const message = new AIMessage(content);
  (message as any).usage_metadata = {
    ...MOCK_OPENAI_USAGE_METADATA,
    ...overrides,
  };
  (message as any).response_metadata = MOCK_OPENAI_RESPONSE_METADATA;
  return message;
}

/**
 * Create an AIMessage without usage metadata (edge case)
 */
export function createAIMessageWithoutUsage(
  content: string = "This is a test response"
): AIMessage {
  return new AIMessage(content);
}

/**
 * Create a sample LLMResult for testing handleLLMEnd.
 * The 'message' property exists at runtime on generation objects but isn't in the TS types.
 */
export function createLLMResult(message: AIMessage): LLMResult {
  return {
    generations: [
      [
        {
          text: typeof message.content === "string" ? message.content : "",
          message,
        } as any,
      ],
    ],
  };
}

/**
 * Create a sample messages array with a system message first
 */
export function createMessagesWithSystem(
  systemContent: string = "You are a helpful assistant."
): [SystemMessage, HumanMessage] {
  return [new SystemMessage(systemContent), new HumanMessage("Hello, help me please")];
}

/**
 * Create a sample messages array without a system message
 */
export function createMessagesWithoutSystem(): [HumanMessage, AIMessage] {
  return [new HumanMessage("Hello"), new AIMessage("Hi there!")];
}

/**
 * Expected normalized model names (for verification)
 */
export const MODEL_NAME_MAPPINGS = {
  // Anthropic versioned -> base
  "claude-haiku-4-5-20251001": "claude-haiku-4-5",
  "claude-sonnet-4-5-20251001": "claude-sonnet-4-5",
  "claude-opus-4-5-20251001": "claude-opus-4-5",
  // OpenAI versioned -> base
  "gpt-4.1-mini-2025-04-14": "gpt-4.1-mini",
  "gpt-4.1-2025-04-14": "gpt-4.1",
};
