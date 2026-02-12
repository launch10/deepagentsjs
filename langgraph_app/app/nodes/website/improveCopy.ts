import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { type ImproveCopyStyle, isImproveCopyIntent } from "@types";
import { createContextMessage } from "langgraph-ai-sdk";

/**
 * Get the prompt for the given improve_copy style.
 *
 * NOTE: The agent already receives editWorkflow instructions (read files,
 * create todos, dispatch subagents in parallel) and todoOverrideMiddleware
 * (message first, always todos, pass todo_id). This prompt only describes
 * WHAT to change — the system handles HOW.
 */
function getImproveCopyPrompt(style: ImproveCopyStyle | undefined): string {
  const basePrompt = `Rewrite the copy across ALL sections of this landing page. Keep the same structure, layout, and HTML elements — only change the text content (headlines, subheadlines, body copy, CTAs, labels).

Every component in src/components/*.tsx that contains user-facing text needs updating. Create one todo per component and dispatch them all to subagents in parallel.`;

  const styleGuide = getStyleGuide(style);

  return `${basePrompt}\n\n${styleGuide}`;
}

function getStyleGuide(style: ImproveCopyStyle | undefined): string {
  switch (style) {
    case "professional":
      return `## Style: Professional
- Formal language with industry-standard terminology
- Emphasize trust, reliability, and expertise
- Replace casual phrases with professional alternatives
- Add credibility indicators where appropriate
- Clear, authoritative messaging throughout`;

    case "friendly":
      return `## Style: Friendly
- Casual, conversational language
- Personality and warmth in every section
- Emojis where appropriate (but don't overdo it)
- Feels like talking to a helpful friend
- Engaging and relatable throughout`;

    case "shorter":
      return `## Style: Concise
- Cut unnecessary words and phrases
- Short, punchy sentences
- Remove redundant descriptions
- Get straight to the point
- Only essential information remains`;

    default:
      return `## Style: Improved
- More compelling and clear
- Consistent tone throughout
- Fix any awkward phrasing`;
  }
}

/**
 * Node that rewrites the copy on a landing page based on a selected style.
 * Runs through the full coding agent (same as the edit flow) with the copy
 * style instructions injected as a context message.
 */
export const improveCopyNode = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    if (!state.websiteId || !state.jwt) {
      throw new Error("websiteId and jwt are required");
    }

    // Get style from intent payload
    const style = isImproveCopyIntent(state.intent!)
      ? (state.intent.payload.style as ImproveCopyStyle | undefined)
      : undefined;

    const prompt = getImproveCopyPrompt(style);

    return await createCodingAgent(
      { ...state, isCreateFlow: false },
      {
        messages: state.messages || [],
        extraContext: [createContextMessage(prompt)],
        graphName: "website",
        maxTurnPairs: 10,
        maxChars: 40_000,
        config,
        route: "full", // Always full agent — rewriting copy across all sections is multi-file
      }
    );
  }
);
