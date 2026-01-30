/**
 * Billing Types
 *
 * All types for usage tracking, tracing, and billing persistence.
 */
import type { BaseMessage } from "@langchain/core/messages";

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Raw usage record from a single LLM call.
 * Rails handles all cost calculations - we just capture tokens.
 */
export interface UsageRecord {
  runId: string;
  messageId: string;
  langchainRunId: string;
  parentLangchainRunId?: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  timestamp: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Context accumulated during a single graph execution.
 * Stored in AsyncLocalStorage, populated by the usage tracker callback.
 */
export interface UsageContext {
  runId: string;
  records: UsageRecord[];
  chatId?: number;
  threadId?: string;
  graphName?: string;

  // Message trace - full conversation for debugging
  messages: BaseMessage[];

  // Internal deduplication state
  _seenMessageIds: Set<string>;

  // Model card tracking - maps langchainRunId to metadata from handleChatModelStart
  // This is needed because LangChain passes metadata to handleChatModelStart but not handleLLMEnd
  _runIdToMetadata: Map<string, Record<string, unknown>>;

  // Credit tracking for predictive exhaustion detection
  accountId?: number;
  preRunCreditsRemaining?: number;
}

// ============================================================================
// TRACING
// ============================================================================

/**
 * Context for persisting a conversation trace.
 */
export interface TraceContext {
  chatId: number;
  threadId: string;
  runId: string;
  graphName?: string;
}

/**
 * Usage summary stored with the trace.
 */
export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  llmCallCount: number;
  totalCostMicrocents?: number;
}

/**
 * Serialized message format for JSONB storage.
 */
export interface SerializedMessage {
  type: string;
  content: unknown;
  name?: string;
  id?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  usage_metadata?: unknown;
  response_metadata?: unknown;
  additional_kwargs?: unknown;
  is_context_message: boolean;
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Context for persisting usage records.
 */
export interface UsagePersistContext {
  chatId: number;
  threadId: string;
  graphName?: string;
}
