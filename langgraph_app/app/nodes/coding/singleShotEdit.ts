import { AIMessage } from "@langchain/core/messages";
import { ToolMessage } from "@langchain/core/messages";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { getLLM } from "@core";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { executeTextEditorCommand, type TextEditorInput } from "@tools";
import { getCodingAgentBackend, type MinimalCodingAgentState } from "./agent";
import { buildFileTree, preReadFiles } from "./superlightEditAgent";
import type { WebsiteFilesBackend } from "@services";

/**
 * Native text editor tool definition for bindTools.
 */
const NATIVE_TEXT_EDITOR_TOOL = {
  type: "text_editor_20250429" as const,
  name: "str_replace_based_edit_tool" as const,
};

/**
 * Classify whether an edit request is simple (single-shot) or complex (full agent).
 *
 * Uses the cheapest/fastest LLM to make a quick determination. The LLM has access
 * to the user's message and the file tree (but not file contents) to make its decision.
 *
 * Returns "simple" for targeted edits that touch 1-3 files with straightforward changes.
 * Returns "complex" for structural changes, new sections, multi-file refactors, or bug fixes.
 */
export async function classifyEditWithLLM(
  userMessage: string,
  fileTree: string
): Promise<"simple" | "complex"> {
  const llm = await getLLM({ skill: "coding", speed: "blazing", cost: "paid", maxTier: 5 });

  const classifierPrompt = `You are a routing classifier for a landing page editor. Given a user's edit request and the project file tree, determine if this is a SIMPLE or COMPLEX edit.

SIMPLE edits: Targeted changes to 1-3 existing files. Examples:
- Changing text, colors, fonts, spacing, sizes
- Swapping images or icons
- Showing/hiding elements
- Minor layout adjustments within a component
- Style tweaks (backgrounds, borders, shadows)

COMPLEX edits: Structural changes or multi-file work. Examples:
- Adding new sections or components
- Reorganizing page structure
- Adding interactivity, forms, or logic
- Redesigning or rebuilding a section from scratch
- Changes that affect many files at once ("make the whole page darker")
- Bug reports or things that are "broken"

Respond with ONLY the word "simple" or "complex". Nothing else.

## File Tree
${fileTree}`;

  try {
    const response = await llm.invoke([
      new SystemMessage(classifierPrompt),
      new HumanMessage(userMessage),
    ]);

    const content =
      typeof response.content === "string" ? response.content.trim().toLowerCase() : "complex";
    return content === "simple" ? "simple" : "complex";
  } catch (e) {
    // On failure, default to complex (safer to overshoot)
    console.warn("Edit classifier failed, defaulting to complex:", e);
    return "complex";
  }
}

function buildSingleShotPrompt(fileTree: string, preReadContent: string): string {
  return `You are an expert React/TypeScript developer editing landing page components.

## Rules
1. Preserve tracking: Never remove L10.createLead() calls or tracking imports.
2. Preserve theme colors: Use CSS variable classes (bg-primary, text-foreground, etc.) — never hardcode hex values unless the user explicitly asks for a specific color.
3. Preserve imports: Keep existing imports unless explicitly asked to remove them.
4. Minimal edits: Use str_replace to change only the lines that differ. Pick small, unique anchors.

## Workflow
1. Review the pre-loaded files below — all component source is included
2. Identify which file(s) to edit based on the user's request
3. Use str_replace_based_edit_tool with small, unique old_str values to make targeted changes
4. Briefly confirm what you changed

Keep responses concise. No lengthy explanations.

## Project File Tree
${fileTree}

## All Component Files
${preReadContent}`;
}

/**
 * Single-shot edit: pre-load all files, make one LLM call with native text editor tool,
 * apply edits directly. One retry round if str_replace fails.
 *
 * Returns { messages, status } compatible with WebsiteGraphState.
 */
export async function singleShotEdit(
  state: MinimalCodingAgentState & { messages?: BaseMessage[] },
  contextMessages: BaseMessage[]
): Promise<{ messages: BaseMessage[]; status: "completed" }> {
  const backend = await getCodingAgentBackend(state);

  // Pre-load all component files into context
  const { tree, allPaths } = await buildFileTree(backend);
  const componentPaths = allPaths.filter((p) => p.includes("src/components/"));
  const preReadContent = await preReadFiles(backend, componentPaths);

  const systemPrompt = buildSingleShotPrompt(tree, preReadContent);

  // Get LLM with usage tracking
  const llm = await getLLM({ skill: "coding", speed: "blazing", cost: "paid", maxTier: 3 });

  // Pass native text editor tool via invoke config — this flows through to
  // ChatAnthropic.invocationParams() which calls formatStructuredToolToAnthropic().
  // Using withConfig preserves configFactories (usage tracking) from getLLM().
  const modelWithTools = (llm as any).withConfig({
    tools: [NATIVE_TEXT_EDITOR_TOOL],
  });

  // Round 1: Single-shot edit
  const invokeMessages: BaseMessage[] = [new SystemMessage(systemPrompt), ...contextMessages];

  const response = await modelWithTools.invoke(invokeMessages);
  const toolCalls = response.tool_calls ?? [];

  if (toolCalls.length === 0) {
    // No tool calls — LLM just responded with text
    const [structuredMessage] = await toStructuredMessage(response);
    return { messages: [structuredMessage], status: "completed" };
  }

  // Apply edits and collect results
  const { toolMessages, hasErrors } = await applyEdits(backend, response, toolCalls);

  // Round 2: One retry if any edits failed
  if (hasErrors) {
    const retryMessages: BaseMessage[] = [...invokeMessages, response, ...toolMessages];

    const retryResponse = await modelWithTools.invoke(retryMessages);
    const retryToolCalls = retryResponse.tool_calls ?? [];

    if (retryToolCalls.length > 0) {
      await applyEdits(backend, retryResponse, retryToolCalls);
    }

    // Use the retry response as the final message
    const textContent = extractTextContent(retryResponse);
    const finalMessage = new AIMessage({
      content: textContent || "I've made the requested changes.",
    });
    const [structuredMessage] = await toStructuredMessage(finalMessage);
    return { messages: [structuredMessage], status: "completed" };
  }

  // Success — return the text portion of the response
  const textContent = extractTextContent(response);
  const finalMessage = new AIMessage({
    content: textContent || "I've made the requested changes.",
  });
  const [structuredMessage] = await toStructuredMessage(finalMessage);
  return { messages: [structuredMessage], status: "completed" };
}

/**
 * Apply tool call edits via executeTextEditorCommand.
 * Returns ToolMessages for each call and whether any errors occurred.
 */
async function applyEdits(
  backend: WebsiteFilesBackend,
  aiMessage: AIMessage,
  toolCalls: Array<{ id?: string; name: string; args: Record<string, unknown> }>
): Promise<{ toolMessages: ToolMessage[]; hasErrors: boolean }> {
  const toolMessages: ToolMessage[] = [];
  let hasErrors = false;

  for (const toolCall of toolCalls) {
    const result = await executeTextEditorCommand(
      backend,
      toolCall.args as unknown as TextEditorInput
    );

    if (result.startsWith("Error:")) {
      hasErrors = true;
    }

    toolMessages.push(
      new ToolMessage({
        content: result,
        tool_call_id: toolCall.id ?? `tool-${Date.now()}`,
      })
    );
  }

  return { toolMessages, hasErrors };
}

/**
 * Extract text content from an AIMessage that may have mixed content blocks.
 */
function extractTextContent(message: AIMessage): string {
  if (typeof message.content === "string") {
    return message.content;
  }
  if (Array.isArray(message.content)) {
    return message.content
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("\n");
  }
  return "";
}
