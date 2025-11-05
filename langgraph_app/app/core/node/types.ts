import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { MinimalGraphState } from "@state";

/**
 * Standard Langchain node function signature
 * Plus our minimal graph state
 */
export type NodeFunction<TState extends MinimalGraphState> = (
    state: TState,
    config: LangGraphRunnableConfig
) => Promise<Partial<TState>>;

export type MiddlewareConfigType = Record<string, unknown>;
export interface NodeMiddlewareType<TConfig extends MiddlewareConfigType> {
  <TState extends MinimalGraphState>(
    node: NodeFunction<TState>,
    options: TConfig
  ): NodeFunction<TState>;
  _config?: TConfig;
}

export type { MinimalGraphState }