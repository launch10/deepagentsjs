import type { CodingAgentGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { getBackend } from "./utils/agent";

export const cleanupNode = NodeMiddleware.use({}, async(
  state: CodingAgentGraphState,
  config: LangGraphRunnableConfig,
): Promise<Partial<CodingAgentGraphState>> => {
  const backend = await getBackend(state);
  await backend.cleanup();

  return {}
});