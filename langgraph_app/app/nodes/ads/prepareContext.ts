import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { buildTurnContext } from "@prompts";
import { NodeMiddleware } from "@middleware";
import { type AdsGraphState } from "@state";

/**
 * Commits turn context to state BEFORE the agent runs.
 *
 * By returning the context message through the reducer, it gets a stable
 * position in state.messages. The agent node then just windows
 * state.messages — no injection or ordering reconciliation needed.
 */
export const prepareContextNode = NodeMiddleware.use(
  {},
  async (
    state: AdsGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<AdsGraphState>> => {
    const turnContext = await buildTurnContext(state, config!);
    if (!turnContext) return {};
    return { messages: [turnContext] };
  }
);
