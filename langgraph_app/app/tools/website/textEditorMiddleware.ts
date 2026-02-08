import { createMiddleware, tool } from "langchain";
import { ToolMessage } from "@langchain/core/messages";
import { z } from "zod";
import type { WebsiteFilesBackend } from "@services";
import { isAnthropicModel } from "@core";
import { executeTextEditorCommand, type TextEditorInput } from "./textEditorTool";

/**
 * Native Anthropic text editor tool definition.
 * When passed to the Anthropic API, Claude uses its fine-tuned text editing
 * behavior: picking small, unique anchors for str_replace, getting whitespace
 * right, and succeeding on the first attempt ~90%+ of the time.
 */
const NATIVE_TEXT_EDITOR_TOOL = {
  type: "text_editor_20250728" as const,
  name: "str_replace_based_edit_tool" as const,
};

/**
 * Fallback tool for non-Anthropic models. Same interface, but declared as a
 * regular JSON-schema tool instead of a native Anthropic tool type.
 * The func is never called — wrapToolCall intercepts all calls first.
 */
const FALLBACK_TEXT_EDITOR_TOOL = tool(async () => "unreachable", {
  name: "str_replace_based_edit_tool",
  description:
    "View, create, or edit files. Commands: " +
    "view (read a file), str_replace (replace exact text), " +
    "create (new file), insert (add text after a line).",
  schema: z.object({
    command: z.enum(["view", "str_replace", "create", "insert"]),
    path: z.string().describe("Absolute file path"),
    old_str: z
      .string()
      .optional()
      .describe("Text to find (str_replace only). Pick a small, unique anchor."),
    new_str: z.string().optional().describe("Replacement text (str_replace/insert)"),
    file_text: z.string().optional().describe("Full file content (create only)"),
    insert_line: z.number().optional().describe("Line number to insert after (insert only)"),
    view_range: z
      .array(z.number())
      .length(2)
      .optional()
      .describe("[start, end] line range (view only)"),
  }),
});

/**
 * Creates middleware that bridges Anthropic's native text editor tool to our
 * WebsiteFilesBackend.
 *
 * wrapModelCall: Detects the model type. For Anthropic models, injects the
 *   native `text_editor_20250728` tool so Claude uses its fine-tuned behavior.
 *   For non-Anthropic models, injects a regular JSON-schema tool as fallback.
 *
 * wrapToolCall: Intercepts `str_replace_based_edit_tool` calls and routes them
 *   through executeTextEditorCommand to our virtual filesystem backend.
 */
export function createTextEditorMiddleware(getBackend: () => WebsiteFilesBackend) {
  return createMiddleware({
    name: "text-editor",

    wrapModelCall: async (request, handler) => {
      const editorTool = isAnthropicModel(request.model)
        ? NATIVE_TEXT_EDITOR_TOOL
        : FALLBACK_TEXT_EDITOR_TOOL;

      return handler({
        ...request,
        tools: [...request.tools, editorTool as any],
      });
    },

    wrapToolCall: async (request, handler) => {
      if (request.toolCall.name === "str_replace_based_edit_tool") {
        const result = await executeTextEditorCommand(
          getBackend(),
          request.toolCall.args as TextEditorInput
        );
        return new ToolMessage({
          content: result,
          tool_call_id: request.toolCall.id!,
        });
      }
      return handler(request);
    },
  });
}
