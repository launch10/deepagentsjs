import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { createPseudoMessage } from "@utils";
import type { Website } from "@types";

/**
 * Get the prompt for the given improve_copy style.
 */
function getImproveCopyPrompt(style: Website.ImproveCopyStyle | undefined): string {
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
 * Uses the coding agent to analyze existing files and update the text content.
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

    const agent = await createCodingAgent({ ...state, isFirstMessage: false });
    const prompt = getImproveCopyPrompt(state.improveCopyStyle);

    const result = await agent.invoke(
      {
        messages: [...(state.messages || []), createPseudoMessage(prompt)],
      },
      {
        ...config,
        recursionLimit: 50,
      }
    );

    return {
      messages: result.messages,
      status: "completed",
    };
  }
);
