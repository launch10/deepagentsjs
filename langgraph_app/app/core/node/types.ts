import type { LangGraphRunnableConfig, Send } from "@langchain/langgraph";
import type { CoreGraphState } from "@state";

/**
 * Standard Langchain node function signature
 * Plus our minimal graph state
 */
export type NodeFunction<TState extends CoreGraphState> = (
  state: TState,
  config: LangGraphRunnableConfig
) => Promise<Partial<TState> | Send[]>;

export type MiddlewareConfigType = Record<string, unknown>;
export interface NodeMiddlewareType<TConfig extends MiddlewareConfigType> {
  <TState extends CoreGraphState>(
    node: NodeFunction<TState>,
    options: TConfig
  ): NodeFunction<TState>;
  _config?: TConfig;
}
