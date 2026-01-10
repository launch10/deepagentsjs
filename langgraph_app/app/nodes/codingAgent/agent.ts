import type { CodingAgentGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "./utils/agent";
import { createMultimodalPseudoMessage } from "@utils";

export const codingAgentNode = NodeMiddleware.use(
  {},
  async (
    state: CodingAgentGraphState,
    config: LangGraphRunnableConfig
  ): Promise<Partial<CodingAgentGraphState>> => {
    if (!state.websiteId || !state.jwt) {
      throw new Error("websiteId and jwt are required");
    }
    const agent = await createCodingAgent(state);
    const contextMessage = `
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
    const userMessage =
      state.images.length > 0
        ? createMultimodalPseudoMessage([
            { type: "text" as const, text: contextMessage },
            ...state.images.map((img) => ({
              type: "image_url" as const,
              image_url: { url: img.url },
            })),
          ])
        : { role: "user", content: contextMessage };

    const result = await agent.invoke(
      {
        messages: [...(state.messages || []), userMessage],
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
