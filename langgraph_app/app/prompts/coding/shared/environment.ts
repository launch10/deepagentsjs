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

Environment variables will be injected at build time and used by the LeadForm compound component:
- API endpoints and authentication tokens are configured automatically
- Google Ads tracking IDs are injected for conversion tracking

You do NOT need to code any of these directly. As long as you use the \`LeadForm\` component, tracking is handled automatically.
`;
