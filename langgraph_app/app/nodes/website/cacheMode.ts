import { type WebsiteGraphState } from "@annotation";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { AIMessage } from "@langchain/core/messages";
import { toStructuredMessage } from "langgraph-ai-sdk";
import {
  getSchedulingToolFiles,
  getSchedulingToolMinorEditFiles,
  getSchedulingToolProfessionalFiles,
  getSchedulingToolFriendlyFiles,
  getSchedulingToolShorterFiles,
} from "@cache";
import type { Website } from "@types";

export const CACHE_MODE = process.env.CACHE_MODE === "true";

/**
 * Get files and message for improve_copy command based on style.
 */
function getImproveCopyResponse(style: Website.ImproveCopyStyle | undefined): {
  files: Website.FileMap;
  message: string;
} {
  switch (style) {
    case "professional":
      return {
        files: getSchedulingToolProfessionalFiles(),
        message:
          "I've updated the copy to be more professional with formal language and business-focused messaging.",
      };
    case "friendly":
      return {
        files: getSchedulingToolFriendlyFiles(),
        message:
          "I've made the copy more friendly and approachable with casual language and personality.",
      };
    case "shorter":
      return {
        files: getSchedulingToolShorterFiles(),
        message: "I've made the copy shorter and more concise - straight to the point.",
      };
    default:
      // Default to professional if no style specified
      return {
        files: getSchedulingToolProfessionalFiles(),
        message: "I've improved the copy to be more professional and polished.",
      };
  }
}

/**
 * Cache mode node for testing/development.
 * When CACHE_MODE=true:
 * - create command: Returns scheduling-tool example files
 * - improve_copy command: Returns style-specific version (professional/friendly/shorter)
 * - Other messages: Returns minor edit version with different headline
 * - Always adds a deterministic AIMessage to the stack
 */
export const cacheModeNode = async (
  state: WebsiteGraphState,
  config: LangGraphRunnableConfig
): Promise<Partial<WebsiteGraphState>> => {
  const isCreateCommand = state.command === "create";
  const isImproveCopyCommand = state.command === "improve_copy";

  let files: Website.FileMap;
  let aiMessageContent: string;

  if (isCreateCommand) {
    files = getSchedulingToolFiles();
    aiMessageContent =
      "I've created a scheduling tool landing page for you with a hero section, features, and pricing.";
  } else if (isImproveCopyCommand) {
    const response = getImproveCopyResponse(state.improveCopyStyle);
    files = response.files;
    aiMessageContent = response.message;
  } else {
    files = getSchedulingToolMinorEditFiles();
    aiMessageContent =
      "I've updated the headline and subtitle on your landing page to be more compelling.";
  }

  const commandType = isCreateCommand
    ? "create"
    : isImproveCopyCommand
      ? `improve-copy-${state.improveCopyStyle || "default"}`
      : "edit";

  const rawMessage = new AIMessage({
    content: aiMessageContent,
    id: `cache-mode-${commandType}-${Date.now()}`,
  });

  // Transform to structured message format so it has parsed_blocks in response_metadata
  const [aiMessage] = await toStructuredMessage(rawMessage);

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
