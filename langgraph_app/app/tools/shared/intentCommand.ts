import { ToolMessage } from "langchain";
import { Command } from "@langchain/langgraph";
import type { AgentIntent } from "@types";

/**
 * Build a Command that includes both a ToolMessage and agentIntents.
 * Reduces boilerplate when tools need to update the frontend.
 *
 * The agentIntents update is part of the Command's state update.
 * For this to work, the inner agent (createAgent) must include
 * agentIntents in its stateSchema so the Command update isn't dropped.
 *
 * Usage:
 *   return intentCommand({
 *     toolCallId: config?.toolCall.id,
 *     toolName: "set_logo",
 *     content: { success: true, message: "Logo set" },
 *     intents: [brandIntent("logo_set")],
 *   });
 */
export function intentCommand(opts: {
  toolCallId: string | undefined;
  toolName: string;
  content: Record<string, unknown>;
  intents?: AgentIntent[];
}): Command {
  const update: Record<string, unknown> = {
    messages: [
      new ToolMessage({
        content: JSON.stringify(opts.content),
        tool_call_id: opts.toolCallId ?? "",
        name: opts.toolName,
      }),
    ],
  };

  if (opts.intents?.length) {
    update.agentIntents = opts.intents;
  }

  return new Command({ update });
}
