import type { BaseMessage } from "@langchain/core/messages";

/**
 * Raw usage record - tokens and model only.
 * Rails handles all cost calculations.
 */
export interface UsageRecord {
  runId: string; // Our graph execution ID - correlates all LLM calls from one request
  messageId: string; // Provider's message ID (e.g., "msg_01BeRfQurFVC5z4Ysn3xmVt1") - ties usage to AIMessage
  langchainRunId: string; // LangChain's internal callback run ID (useful for LangSmith)
  parentLangchainRunId?: string;
  model: string; // Raw model name from provider (e.g., "claude-haiku-4-5-20251001")
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  timestamp: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
  // NOTE: No costUsd - Rails handles all pricing calculation
}

/**
 * Context for a single graph execution run.
 * Accumulated via AsyncLocalStorage during execution.
 */
export interface UsageContext {
  runId: string; // Generated once at start - correlates all records from this request
  records: UsageRecord[];
  chatId?: number;
  threadId?: string;
  graphName?: string;

  // System prompt capture (for trace completeness / backwards compatibility)
  systemPrompt?: string;
  systemPromptCaptured?: boolean;

  /**
   * Clean ordered array of ALL messages in the conversation.
   * Captures: [SystemMessage, HumanMessage, ContextMessage, AIMessage, ToolMessage, ...]
   *
   * - Input messages captured via handleChatModelStart
   * - Output messages (AIMessage) captured via handleLLMEnd
   * - Deduplication via _seenMessageIds to avoid counting same message twice
   */
  messages: BaseMessage[];

  /**
   * Track message IDs we've already captured to avoid duplicates.
   * handleChatModelStart receives cumulative messages, so we need to detect
   * which ones are new on subsequent LLM calls.
   */
  _seenMessageIds: Set<string>;

  /**
   * Track message count from previous handleChatModelStart call.
   * Used to detect new messages when IDs aren't available.
   */
  _lastInputMessageCount: number;

  userInput?: BaseMessage; // Set at run start, not from callback
}
