import { createMiddleware } from "langchain";
import { ToolMessage } from "@langchain/core/messages";
import type { WebsiteFilesBackend } from "@services";
import { executeTextEditorCommand, type TextEditorInput } from "./textEditorTool";

/**
 * Native Anthropic text editor tool definition.
 * When passed to the Anthropic API, Claude uses its fine-tuned text editing
 * behavior: picking small, unique anchors for str_replace, getting whitespace
 * right, and succeeding on the first attempt ~90%+ of the time.
 */
const NATIVE_TEXT_EDITOR_TOOL = {
  type: "text_editor_20250429" as const,
  name: "str_replace_based_edit_tool" as const,
};

/**
 * Creates middleware that bridges Anthropic's native text editor tool to our
 * WebsiteFilesBackend.
 *
 * wrapModelCall: Injects the native tool definition into the model's tool list.
 *   Claude sees `type: "text_editor_20250429"` and uses its trained behavior.
 *
 * wrapToolCall: Intercepts `str_replace_based_edit_tool` calls (which have no
 *   registered ClientTool) and routes them through executeTextEditorCommand
 *   to our virtual filesystem backend.
 */
export function createTextEditorMiddleware(getBackend: () => WebsiteFilesBackend) {
  return createMiddleware({
    name: "text-editor",

    wrapModelCall: async (request, handler) => {
      return handler({
        ...request,
        tools: [...request.tools, NATIVE_TEXT_EDITOR_TOOL as any],
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
