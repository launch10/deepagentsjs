import type { BaseMessage } from "@langchain/core/messages";
import type { LangGraphRunnableConfig, CompiledStateGraph } from "@langchain/langgraph";
import { runWithUsageTracking, type UsageRecord } from "./usageTracker";

/**
 * Result of a tracked graph execution.
 * Includes the graph result plus all accumulated usage and trace data.
 */
export interface TrackedExecutionResult<TState> {
  result: TState;
  runId: string;
  usage: UsageRecord[];
  systemPrompt?: string;
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
  const { result, runId, usage, systemPrompt, messagesProduced } = await runWithUsageTracking(
    {
      chatId: options.chatId,
      threadId: options.threadId,
      graphName: options.graphName,
      userInput: options.userInput,
    },
    () => graph.invoke(state, config)
  );

  return {
    result,
    runId,
    usage,
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
  const { result, runId, usage, systemPrompt, messagesProduced } = await runWithUsageTracking(
    {
      chatId: options.chatId,
      threadId: options.threadId,
      graphName: options.graphName,
      userInput: options.userInput,
    },
    async () => {
      const graphResult = await graph.invoke(state, config);

      if (graphResult && graphResult.__interrupt__) {
        const checkpoint = await graph.getState(config);
        return { state: checkpoint.values as TState, interrupted: true };
      }

      return { state: graphResult as TState, interrupted: false };
    }
  );

  return {
    result: result.state,
    runId,
    usage,
    systemPrompt,
    messagesProduced,
    interrupted: result.interrupted,
  };
}
