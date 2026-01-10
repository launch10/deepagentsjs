/**
 * Environment variables available to generated landing pages.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const environmentPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Environment & Configuration

Environment variables are injected at build time and used by the L10 library:
- API endpoints and authentication tokens are configured automatically
- Google Ads tracking IDs are injected for conversion tracking

You do NOT need to access these directly. Use \`L10.createLead()\` for lead capture - it handles all configuration transparently.
`;
