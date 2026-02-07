import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { type ImproveCopyStyle, isImproveCopyIntent } from "@types";
import { injectAgentContext } from "@api/middleware";

/**
 * Get the prompt for the given improve_copy style.
 */
function getImproveCopyPrompt(style: ImproveCopyStyle | undefined): string {
  const basePrompt = `Review and rewrite all the copy on this landing page. Keep the same structure and HTML elements, but update the text content.`;

  switch (style) {
    case "professional":
      return `${basePrompt}

Make the tone more professional and business-focused:
- Use formal language and industry-standard terminology
- Emphasize trust, reliability, and expertise
- Replace casual phrases with professional alternatives
- Add credibility indicators where appropriate
- Keep the messaging clear and authoritative`;

    case "friendly":
      return `${basePrompt}

Make the tone more friendly and approachable:
- Use casual, conversational language
- Add personality and warmth to the copy
- Include emojis where appropriate (but don't overdo it)
- Make it feel like talking to a helpful friend
- Keep it engaging and relatable`;

    case "shorter":
      return `${basePrompt}

Make all copy shorter and more concise:
- Cut unnecessary words and phrases
- Use short, punchy sentences
- Remove redundant descriptions
- Get straight to the point
- Keep only the essential information`;

    default:
      return `${basePrompt}

Improve the overall quality of the copy:
- Make it more compelling and clear
- Ensure consistent tone throughout
- Fix any awkward phrasing`;
  }
}

/**
 * Node that rewrites the copy on a landing page based on a selected style.
 * Uses single-shot edit (Haiku + native text_editor) for cost-effective copy rewrites.
 * All src/ files are pre-loaded — the LLM rewrites copy via str_replace in one call.
 */
export const improveCopyNode = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    _config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    if (!state.websiteId || !state.jwt) {
      throw new Error("websiteId and jwt are required");
    }

    // Get style from intent payload
    const style = isImproveCopyIntent(state.intent!)
      ? (state.intent.payload.style as ImproveCopyStyle | undefined)
      : undefined;

    const prompt = getImproveCopyPrompt(style);

    // Inject brainstorm.finished context so Haiku knows the brand voice
    const messagesWithContext =
      state.projectId && state.jwt
        ? await injectAgentContext({
            graphName: "website",
            projectId: state.projectId,
            jwt: state.jwt,
            messages: [...(state.messages || []), new HumanMessage(prompt)],
          })
        : [...(state.messages || []), new HumanMessage(prompt)];

    return await createCodingAgent(
      { ...state, isCreateFlow: false },
      {
        messages: messagesWithContext,
        route: "single-shot",
      }
    );
  }
);
