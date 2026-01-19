import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { getCodingAgentBackend, type MinimalCodingAgentState } from "@nodes";

export const cleanupFilesystemNode = NodeMiddleware.use(
  {},
  async (
    state: MinimalCodingAgentState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    // const backend = await getCodingAgentBackend(state);
    // await backend.cleanup();

    return {};
  }
);