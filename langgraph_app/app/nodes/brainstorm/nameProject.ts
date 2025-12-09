import { type WebsiteGraphState } from "@state";
import { NameProjectService } from "@services";
import { type LangGraphRunnableConfig } from "@langchain/langgraph";
import { lastHumanMessage } from "@types";
import { NodeMiddleware } from "@core";

/**
 * Node that generates a project name based on the user's request
 */
export const nameProjectNode = NodeMiddleware.use(
  async (
    state: WebsiteGraphState,
    config?: LangGraphRunnableConfig
  ): Promise<Partial<WebsiteGraphState>> => {
    if (!state.messages) {
      throw new Error("messages are required");
    }

    const content = lastHumanMessage({ messages: state.messages })?.content;
    if (!content) {
      throw new Error("User request is required");
    }

    // Extract text from content (handles both string and complex content)
    const userRequest =
      typeof content === "string"
        ? content
        : content.map((c) => ("text" in c ? c.text : "")).join("");

    const projectNameGenerator = new NameProjectService();
    const projectName = await projectNameGenerator.execute({ userRequest }, config);
    return { projectName };
  }
);
