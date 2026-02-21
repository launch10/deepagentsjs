import z from "zod";
import { tool, ToolMessage } from "langchain";
import { Command } from "@langchain/langgraph";
import { Workflow } from "@types";

export const navigateTool = tool(
  async (input, config) => {
    return new Command({
      update: {
        agentIntents: [
          {
            type: "navigate" as const,
            payload: { page: input.page, substep: input.substep },
            createdAt: new Date().toISOString(),
          },
        ],
        messages: [
          new ToolMessage({
            content: `Navigating to ${input.page}`,
            tool_call_id: config?.toolCall.id,
            status: "success",
            name: "navigateTool",
          }),
        ],
      },
    });
  },
  {
    name: "navigateTool",
    description:
      "Navigate the user to a different page in the workflow.",
    schema: z.object({
      page: z.enum(Workflow.WorkflowPages),
      substep: z.string().optional(),
    }),
    returnDirect: true,
  }
);
