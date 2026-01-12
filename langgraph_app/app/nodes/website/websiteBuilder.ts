import type { WebsiteGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "@nodes";
import { createMultimodalPseudoMessage, isFirstMessage } from "@utils";

const createContextMessage = (state: WebsiteGraphState) => {
  const contextContent = `
      ## Brainstorm Context
      - Idea: ${state.brainstorm.idea || "Not provided"}
      - Audience: ${state.brainstorm.audience || "Not provided"}
      - Solution: ${state.brainstorm.solution || "Not provided"}
      - Social Proof: ${state.brainstorm.socialProof || "Not provided"}

      ## Theme
      ${state.theme ? `Using theme: ${state.theme.name}` : "Using default theme"}

      ## Images
      ${state.images.length > 0 ? state.images.map((img) => `- ${img.url}${img.isLogo ? " (logo)" : ""}`).join("\n") : "No images uploaded"}

      Please create a landing page based on this context.
    `;

  // Build user message - combine context with visual images if available
  const contextMessage =
    state.images.length > 0
      ? createMultimodalPseudoMessage([
          { type: "text" as const, text: contextContent },
          ...state.images.map((img) => ({
            type: "image_url" as const,
            image_url: { url: img.url },
          })),
        ])
      : { role: "user", content: contextContent };

  return contextMessage;
};

export const websiteBuilderNode = NodeMiddleware.use(
  {},
  async (
    state: WebsiteGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    if (!state.websiteId || !state.jwt) {
      throw new Error("websiteId and jwt are required");
    }

    const agent = await createCodingAgent({ ...state, isFirstMessage: isFirstMessage(state) });
    const contextMessage = createContextMessage(state);
    const result = await agent.invoke(
      {
        messages: [...(state.messages || []), contextMessage],
      },
      {
        recursionLimit: 100,
        ...config,
      }
    );

    return {
      messages: result.messages,
      status: "completed",
    };
  }
);
