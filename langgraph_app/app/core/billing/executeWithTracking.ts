import type { BaseMessage } from "@langchain/core/messages";
import type { LangGraphRunnableConfig, CompiledStateGraph } from "@langchain/langgraph";
import { runWithUsageTracking, type UsageRecord } from "./usageTracker";
import { persistTrace, type UsageSummary } from "./persistTrace";
import { persistUsage } from "./persistUsage";
import { notifyRails } from "./notifyRails";

/**
 * Result of a tracked graph execution.
 * Includes the graph result plus all accumulated usage and trace data.
 */
export interface TrackedExecutionResult<TState> {
  result: TState;
  runId: string;
  usage: UsageRecord[];
  /** Clean ordered array of ALL messages: [System, Human, Context, AI, Tool, AI, ...] */
  messages: BaseMessage[];
  /** @deprecated Use messages instead */
  systemPrompt?: string;
  /** @deprecated Use messages instead */
  messagesProduced: BaseMessage[];
}

/**
 * Options for tracked execution.
 */
export interface ExecuteWithTrackingOptions {
  chatId?: number;
  threadId?: string;
  graphName?: string;
  userInput?: BaseMessage;
  /**
   * If true, automatically persists usage and trace to database after execution.
   * Requires chatId and threadId to be set.
   * Default: false (for backwards compatibility)
   */
  persist?: boolean;
}

type CompiledGraph = CompiledStateGraph<any, any, any, any, any, any, any, any, any>;

/**
 * Execute a graph with usage tracking enabled.
 *
 * This is the production wrapper that:
 * 1. Sets up AsyncLocalStorage context via runWithUsageTracking()
 * 2. Executes the graph
 * 3. Returns accumulated usage records and trace data
 *
 * All LLM calls made during execution (agents, tools, middleware) will have
 * their usage captured via the usageTracker callback attached by getLLM().
 *
 * @example
 * ```typescript
 * const { result, usage, runId } = await executeWithTracking(
 *   brainstormGraph,
 *   state,
 *   config,
 *   { chatId: chat.id, threadId, graphName: "brainstorm" }
 * );
 *
 * // Persist usage to database
 * await persistUsageRecords(usage, chatId, runId, graphName);
 * ```
 */
export async function executeWithTracking<TState>(
  graph: CompiledGraph,
  state: TState,
  config: LangGraphRunnableConfig,
  options: ExecuteWithTrackingOptions = {}
): Promise<TrackedExecutionResult<TState>> {
  const { result, runId, usage, messages, systemPrompt, messagesProduced } =
    await runWithUsageTracking(
      {
        chatId: options.chatId,
        threadId: options.threadId,
        graphName: options.graphName,
        userInput: options.userInput,
      },
      () => graph.invoke(state as Parameters<typeof graph.invoke>[0], config)
    );

  // Optionally persist to database
  if (options.persist && options.chatId && options.threadId) {
    await persistTraceAndUsage({
      chatId: options.chatId,
      threadId: options.threadId,
      runId,
      graphName: options.graphName,
      messages,
      usage,
    });
  }

  return {
    result,
    runId,
    usage,
    messages,
    systemPrompt,
    messagesProduced,
  };
}

/**
 * Execute a graph with tracking and handle interrupts.
 *
 * Same as executeWithTracking but also handles LangGraph's interrupt mechanism,
 * returning the checkpointed state when an interrupt occurs.
 */
export async function executeWithTrackingAndInterrupt<TState>(
  graph: CompiledGraph,
  state: TState,
  config: LangGraphRunnableConfig,
  options: ExecuteWithTrackingOptions = {}
): Promise<TrackedExecutionResult<TState> & { interrupted: boolean }> {
  const { result, runId, usage, messages, systemPrompt, messagesProduced } =
    await runWithUsageTracking(
      {
        chatId: options.chatId,
        threadId: options.threadId,
        graphName: options.graphName,
        userInput: options.userInput,
      },
      async () => {
        const graphResult = await graph.invoke(state as Parameters<typeof graph.invoke>[0], config);

        if (graphResult && graphResult.__interrupt__) {
          const checkpoint = await graph.getState(config);
          return { state: checkpoint.values as TState, interrupted: true };
        }

        return { state: graphResult as TState, interrupted: false };
      }
    );

  // Optionally persist to database
  if (options.persist && options.chatId && options.threadId) {
    await persistTraceAndUsage({
      chatId: options.chatId,
      threadId: options.threadId,
      runId,
      graphName: options.graphName,
      messages,
      usage,
    });
  }

  return {
    result: result.state,
    runId,
    usage,
    messages,
    systemPrompt,
    messagesProduced,
    interrupted: result.interrupted,
  };
}

/**
 * Internal helper to persist trace and usage data in parallel,
 * then notify Rails to trigger credit charging.
 */
interface PersistParams {
  chatId: number;
  threadId: string;
  runId: string;
  graphName?: string;
  messages: BaseMessage[];
  usage: UsageRecord[];
}

async function persistTraceAndUsage(params: PersistParams): Promise<void> {
  const { chatId, threadId, runId, graphName, messages, usage } = params;

  // Compute usage summary
  const usageSummary: UsageSummary = {
    totalInputTokens: usage.reduce((sum, r) => sum + r.inputTokens, 0),
    totalOutputTokens: usage.reduce((sum, r) => sum + r.outputTokens, 0),
    llmCallCount: usage.length,
  };

  // Persist trace and usage in parallel
  await Promise.all([
    persistTrace({ chatId, threadId, runId, graphName }, messages, usageSummary),
    persistUsage(usage, { chatId, threadId, graphName }),
  ]);

  // Fire-and-forget notification to Rails
  // Rails has backup polling job for reliability
  notifyRails(runId);
}
