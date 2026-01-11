import type { CodingAgentGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { getCodingAgentBackend } from "./utils/agent";

export const cleanupFilesystemNode = NodeMiddleware.use(
  {},
  async (
    state: CodingAgentGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<CodingAgentGraphState>> => {
    if (!state.websiteId || !state.jwt) {
      // Nothing to clean up if no website context
      return {};
    }
    const backend = await getCodingAgentBackend(state);
    await backend.cleanup();

    return {};
  }
);
