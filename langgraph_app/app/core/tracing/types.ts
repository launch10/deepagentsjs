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
 * Usage summary for the trace.
 */
export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  llmCallCount: number;
  totalCostMicrocents?: number;
}

/**
 * Serialized message format for storage in JSONB.
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
  /** Flag for easy SQL filtering of context messages */
  is_context_message: boolean;
}
