import { StructuredTool } from "@langchain/core/tools";

export { createStructuredOutputTool, StructuredOutputTool } from "./structuredOutput";
export * from "./typeGuards";

import { initTools as initListFiles } from "./listFiles";
import { initTools as initSearchFiles } from "./searchFiles";
import { initTools as initSearchThemes } from "./searchThemes";
import { initTools as initSearchIcons } from "./searchIcons";

export const initTools = async (state: any): Promise<Record<string, StructuredTool>> => {
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