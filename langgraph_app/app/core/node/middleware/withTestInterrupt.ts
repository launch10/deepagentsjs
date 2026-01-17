import type { NodeFunction } from "../types";
import type { CoreGraphState } from "@types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { interrupt } from "@langchain/langgraph";
import { env } from "@core";

// withTestInterrupt doesn't take any config
type WithTestInterruptConfig = Record<string, never>;

// Global registry for test stop conditions
type StopCondition<TState = any> = (state: TState) => boolean;

let globalStopCondition: StopCondition | null = null;

/**
 * Register a stop condition for tests.
 * When the condition returns true, the graph will interrupt.
 */
export function registerTestStopCondition<TState>(condition: StopCondition<TState>): void {
  globalStopCondition = condition;
}

/**
 * Clear the registered stop condition.
 */
export function clearTestStopCondition(): void {
  globalStopCondition = null;
}

/**
 * Check if there's a registered stop condition.
 */
export function hasTestStopCondition(): boolean {
  return globalStopCondition !== null;
}

/**
 * Wraps a node function to check stop conditions after execution.
 * If the condition is met, triggers a LangGraph interrupt.
 */
export const withTestInterrupt = <TState extends CoreGraphState>(
  nodeFunction: NodeFunction<TState>,
  _options: WithTestInterruptConfig
): NodeFunction<TState> => {
  return async (state: TState, config: LangGraphRunnableConfig) => {
    const result = await nodeFunction(state, config);

    // Only check in test mode and if there's a condition registered
    if (env.NODE_ENV !== "test" || !globalStopCondition) {
      return result;
    }

    // Merge result with state to check the condition
    const mergedState = { ...state, ...result } as TState;

    if (globalStopCondition(mergedState)) {
      // Clear condition so we don't keep interrupting
      clearTestStopCondition();
      // Trigger LangGraph interrupt with the result
      interrupt({ result, reason: "test_stop_condition_met" });
    }

    return result;
  };
};
