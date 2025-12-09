import type { CodingAgentGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { createCodingAgent } from "./utils/agent";

export const codingAgentNode = NodeMiddleware.use({}, async(
  state: CodingAgentGraphState,
  config: LangGraphRunnableConfig,
): Promise<Partial<CodingAgentGraphState>> => {
  const agent = createCodingAgent(state);

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

  const result = await agent.invoke(
    {
      messages: [
        ...(state.messages || []),
        { role: "user", content: contextMessage },
      ],
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
});