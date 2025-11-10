import { StructuredTool } from "@langchain/core/tools";
import type { WebsiteGraphState } from "@state";

import { initListFiles } from "./listFiles";
import { initSearchFiles } from "./searchFiles";
import { initSearchThemes } from "./searchThemes";
import { initSearchIcons } from "./searchIcons";

export const initWebsiteTools = async (state: WebsiteGraphState): Promise<Record<string, StructuredTool>> => {
  const tools = await Promise.all([
    initListFiles(state),
    initSearchFiles(state),
    initSearchThemes(state),
    initSearchIcons(state)
  ]);

  return tools.reduce((acc: Record<string, StructuredTool>, tool: Record<string, StructuredTool>) => { 
    return { ...acc, ...tool }
  }, {});
}