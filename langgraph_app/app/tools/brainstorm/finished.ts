import z from "zod";
import { tool, ToolMessage } from "langchain";
import { Command } from "@langchain/langgraph";

export const finishedTool = tool(
  async (input, config) => {
    return new Command({
        update: {
            redirect: "website" as const,
            messages: [new ToolMessage({
                content: "Redirecting to website builder",
                tool_call_id: config?.toolCall.id,
                status: "success",
                name: "finishedTool",
            })]
        }
    });
  },
  {
    name: "finishedTool",
    description: "Indicate that the user is finished and ready to build their landing page.",
    schema: z.object({}), // Empty object = no arguments
    returnDirect: true,  // 🔥 Short-circuit the graph!
  }
);
