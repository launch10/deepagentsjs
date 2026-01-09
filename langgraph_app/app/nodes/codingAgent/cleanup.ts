import type { CodingAgentGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { getCodingAgentBackend } from "./utils/agent";

export const cleanupNode = NodeMiddleware.use(
  {},
  async (
    state: CodingAgentGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<CodingAgentGraphState>> => {
    const backend = await getCodingAgentBackend(state);
    await backend.cleanup();

    return {};
  }
);
