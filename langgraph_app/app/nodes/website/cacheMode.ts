import { type WebsiteGraphState } from "@annotation";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { schedulingToolFiles, schedulingToolMinorEditFiles } from "@cache";

export const CACHE_MODE = process.env.CACHE_MODE === "true";

/**
 * Cache mode node for testing/development.
 * When CACHE_MODE=true:
 * - First message (create command): Returns scheduling-tool example files
 * - 2nd+ message: Returns minor edit version with different headline
 * - Always adds a deterministic AIMessage to the stack
 */
export const cacheModeNode = async (
  state: WebsiteGraphState,
  config: LangGraphRunnableConfig
): Promise<Partial<WebsiteGraphState>> => {
  const isFirstMessage = state.command === "create";

  // Pick which cached files to return
  const files = isFirstMessage
    ? schedulingToolFiles
    : schedulingToolMinorEditFiles;

  // Create a deterministic AI message
  const aiMessageContent = isFirstMessage
    ? "I've created a scheduling tool landing page for you with a hero section, features, and pricing."
    : "I've updated the headline and subtitle on your landing page to be more compelling.";

  const aiMessage = new AIMessage({
    content: aiMessageContent,
    id: `cache-mode-${isFirstMessage ? "create" : "edit"}-${Date.now()}`,
  });

  return {
    messages: [...(state.messages || []), aiMessage],
    files,
    status: "completed",
  };
};

/**
 * Helper to check if cache mode is enabled
 */
export const isCacheModeEnabled = (): boolean => CACHE_MODE;
