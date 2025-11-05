import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export type ErrorStateType = { message: string, node: string };
export type MinimalStateType = Record<string, unknown> & {
  error?: ErrorStateType
}

export type NodeFunction<TState extends MinimalStateType> = (
  state: TState,
  config: LangGraphRunnableConfig
) => Promise<Partial<TState>> | Partial<TState>;

export type MiddlewareConfigType = Record<string, unknown>;
export interface NodeMiddlewareType<TConfig extends MiddlewareConfigType> {
  <TState extends MinimalStateType>(
    node: NodeFunction<TState>,
    options: TConfig
  ): NodeFunction<TState>;
  _config?: TConfig;
}