import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { toStructuredMessage, createContextMessage } from "langgraph-ai-sdk";
import { NodeMiddleware } from "@middleware";
import { createLightEditAgent } from "@nodes";
import { type ImproveCopyStyle, isImproveCopyIntent, lastAIMessage } from "@types";

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

const IMPROVE_COPY_SYSTEM_PROMPT = `You are an expert conversion copywriter and React/TypeScript developer editing landing page components.

Your job is to rewrite the copy in each component file while preserving the structure, styling, and functionality.

## Rules
1. Read first: Always read the target file before modifying it.
2. Preserve tracking: Never remove L10.createLead() calls or tracking imports.
3. Preserve theme colors: Use CSS variable classes (bg-primary, text-foreground, etc.) — never hardcode hex values.
4. Preserve imports: Keep existing imports unless explicitly asked to remove them.
5. Preserve component structure: Don't change layouts, styling, or element hierarchy. Only change text content.
6. Use write_file: Write the complete updated file content (preferred for copy rewrites that touch many strings).

## Workflow
1. Use glob to find all component files in src/components/ and src/pages/
2. Read ALL component files in parallel (one message with multiple read_file calls)
3. Rewrite the copy in each file according to the style instructions
4. Write all updated files (use write_file with complete content for each)
5. Briefly confirm what you changed

Keep responses concise. No lengthy explanations.`;

/**
 * Node that rewrites the copy on a landing page based on a selected style.
 * Uses the light edit agent (Haiku) for cost-effective copy rewrites.
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

    const agent = await createLightEditAgent(
      { ...state, isFirstMessage: false },
      { systemPrompt: IMPROVE_COPY_SYSTEM_PROMPT }
    );

    const prompt = getImproveCopyPrompt(style);

    const result = await agent.invoke(
      {
        messages: [...(state.messages || []), createContextMessage(prompt)],
      },
      {
        ...config,
        recursionLimit: 25,
      }
    );

    // Only return user-visible messages to the outer graph
    const lastAI = lastAIMessage(result);
    const [structuredMessage] = lastAI ? await toStructuredMessage(lastAI) : [undefined];

    return {
      messages: structuredMessage ? [structuredMessage] : [],
      status: "completed",
    };
  }
);
