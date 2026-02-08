import { AIMessage } from "@langchain/core/messages";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { getLLM, rollbar, getLogger } from "@core";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { executeTextEditorCommand, type TextEditorInput } from "@tools";
import { getCodingAgentBackend, getTheme, type MinimalCodingAgentState } from "./agent";
import { buildFileTree, preReadFiles } from "./fileContext";
import type { CodingPromptState } from "@prompts";
import type { WebsiteFilesBackend } from "@services";

/**
 * Native text editor tool definition with prompt caching.
 * The cache_control breakpoint on the tool caches system prompt + tool definition
 * together, matching the 3-tier caching in promptCachingMiddleware.
 */
const NATIVE_TEXT_EDITOR_TOOL = {
  type: "text_editor_20250728" as const,
  name: "str_replace_based_edit_tool" as const,
  cache_control: { type: "ephemeral" as const },
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
- Reordering, swapping, hiding, or removing existing sections (just editing the composition root)

COMPLEX edits: Structural changes or multi-file work. Examples:
- Adding NEW sections or components that don't exist yet
- Adding interactivity, forms, or logic
- Redesigning or rebuilding a section from scratch
- Changes that affect many files at once ("make the whole page darker")
- Bug reports, complaints about something being "wrong", or visual issues that need investigation (gaps, misalignment, broken layout)

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
    getLogger().warn({ err: e }, "Edit classifier failed, defaulting to complex");
    return "complex";
  }
}

/**
 * Build condensed design guidance for the single-shot prompt.
 * Includes the most impactful subset of the full coding agent's design context:
 * theme colors, typography hierarchy, hover/animation patterns, and CSS variables.
 */
function buildDesignGuidance(theme?: CodingPromptState["theme"]): string {
  const sections: string[] = [];

  // Theme colors — essential for color/background edits
  sections.push(`## Theme Colors (shadcn)

Use semantic color classes:
| Element | Background | Text on it |
|---------|-----------|------------|
| Page | bg-background | text-foreground |
| Primary (hero/CTAs) | bg-primary | text-primary-foreground |
| Secondary (buttons) | bg-secondary | text-secondary-foreground |
| Muted/subtle | bg-muted | text-muted-foreground |
| Cards | bg-card | text-card-foreground |

Section backgrounds: ONLY bg-background, bg-muted, or bg-primary. Never bg-secondary/bg-accent/bg-card for sections.`);

  // CSS variable values — so the LLM knows what colors actually resolve to
  if (theme?.semanticVariables) {
    const vars = Object.entries(theme.semanticVariables)
      .map(([key, value]) => `  ${key}: ${value}`)
      .join("\n");
    sections.push(`## CSS Variables (HSL)\n${vars}`);
  }

  // Tracking — never remove tracking calls
  sections.push(`## Tracking
NEVER remove L10.createLead() calls or tracking imports.`);

  return sections.join("\n\n");
}

/**
 * Build the system prompt with cache_control breakpoint on the last content block.
 * Since we call .invoke() directly (no agent loop), the promptCachingMiddleware
 * doesn't apply. We add cache breakpoints manually so the ~28K system prompt
 * is cached across edits to the same website.
 */
function buildSingleShotSystemMessage(
  fileTree: string,
  preReadContent: string,
  theme?: CodingPromptState["theme"]
): SystemMessage {
  const designGuidance = buildDesignGuidance(theme);

  const text = `You are an expert landing page developer with great design taste. You make edits to React/TypeScript landing page components in a SINGLE response.

IMPORTANT: You MUST always make at least one edit. NEVER respond with only text.
If the request is vague (e.g., 'make the headline better'), use your best creative
judgment and make the change. Do NOT ask clarifying questions.

CRITICAL RULES:
- This is a single-shot edit. You get ONE response.
- All file contents are pre-loaded below — NEVER use the "view" command. Go straight to str_replace edits.
- ONLY edit files listed in the file tree below. NEVER guess or invent file paths that don't appear in the tree.

## File Structure
- **src/pages/IndexPage.tsx** (or src/App.tsx if no pages/ dir) is the PAGE COMPOSITION ROOT — it imports and renders all section components. For layout changes that affect the page structure (reordering sections, hiding/removing sections, adding spacing between sections), edit the composition root.
- **src/components/*.tsx** are individual section components (Hero, Features, CTA, etc.). For changes within a specific section (text, colors, styles), edit that component file directly.

## Rules
1. Use CSS variable classes (bg-primary, text-foreground, etc.) — never hardcode hex values unless the user explicitly asks for a specific color.
2. Preserve imports: Keep existing imports unless explicitly asked to remove them.
3. Minimal edits: Use str_replace to change only the lines that differ. Pick small, unique anchors.

${designGuidance}

## Workflow
1. All source files are pre-loaded below — read them directly, do NOT call view
2. Identify which file(s) to edit based on the user's request
3. Use str_replace_based_edit_tool with command "str_replace" to make targeted changes
4. Write a brief (1-2 sentence) confirmation of what you changed

## Project File Tree
${fileTree}

## All Source Files (pre-loaded — do NOT use view)
${preReadContent}`;

  return new SystemMessage({
    content: [
      {
        type: "text",
        text,
        cache_control: { type: "ephemeral" as const },
      },
    ],
  });
}

/**
 * Single-shot edit: pre-load all files, make one LLM call with native text editor tool,
 * apply edits directly. No retry on invalid input — successful edits are already applied.
 *
 * Accepts an optional pre-created backend to avoid duplicate DB queries when the
 * caller (websiteBuilder) already created one for classification.
 *
 * Returns { messages, status, allFailed } compatible with WebsiteGraphState.
 * `allFailed` is true when all edits failed even after retry — caller can escalate.
 */
export async function singleShotEdit(
  state: MinimalCodingAgentState & { messages?: BaseMessage[] },
  contextMessages: BaseMessage[],
  existingBackend?: WebsiteFilesBackend
): Promise<{ messages: BaseMessage[]; status: "completed"; allFailed?: boolean }> {
  const backend = existingBackend ?? (await getCodingAgentBackend(state));

  // Pre-load source files into context: page components, pages, app root, CSS, libs.
  // Exclude ui/ library components (shadcn) — rarely edited and adds ~15K tokens of noise.
  const { tree, allPaths } = await buildFileTree(backend);
  const sourcePaths = allPaths.filter(
    (p) => p.includes("src/") && !p.includes("/components/ui/") && /\.(tsx?|css)$/.test(p)
  );

  // Fetch theme for design guidance (CSS variables, typography) — parallelize with file reads
  const [preReadContent, theme] = await Promise.all([
    preReadFiles(backend, sourcePaths),
    state.theme ? Promise.resolve(state.theme) : getTheme(state),
  ]);
  getLogger().debug(
    { sourceFileCount: sourcePaths.length, theme: theme?.name ?? "none" },
    "Pre-loading source files"
  );

  const systemMessage = buildSingleShotSystemMessage(tree, preReadContent, theme);

  // Get LLM with usage tracking
  const llm = await getLLM({ skill: "coding", speed: "blazing", cost: "paid", maxTier: 2 });

  // Pass native text editor tool and notify tag via withConfig — this flows through to
  // ChatAnthropic.invocationParams() which calls formatStructuredToolToAnthropic().
  // Using withConfig preserves configFactories (usage tracking) from getLLM().
  // The "notify" tag enables RawMessageHandler to stream tokens to the frontend.
  const modelWithTools = (llm as any).withConfig({
    tags: ["notify"],
    tools: [NATIVE_TEXT_EDITOR_TOOL],
  });

  // Single-shot: one LLM call, apply all edits
  const invokeMessages: BaseMessage[] = [systemMessage, ...contextMessages];

  const response = await modelWithTools.invoke(invokeMessages);
  const toolCalls = response.tool_calls ?? [];

  getLogger().debug({ toolCallCount: toolCalls.length }, "Single-shot tool calls");

  if (toolCalls.length === 0) {
    // Text-only response = agent asked questions or didn't edit. Escalate.
    getLogger().warn("Single-shot returned text-only, signaling escalation");
    const [structuredMessage] = await toStructuredMessage(response);
    return { messages: [structuredMessage], status: "completed", allFailed: true };
  }

  // Filter out "view" calls — all files are pre-loaded, view is a wasted call.
  // Only apply actual mutations (str_replace, create, insert).
  const editCalls = toolCalls.filter((tc: any) => (tc.args as any)?.command !== "view");
  const hadViewOnly = editCalls.length === 0 && toolCalls.length > 0;

  // Apply edits (if any). Successful edits are applied to the backend immediately.
  let successCount = 0;
  let errors: string[] = [];

  if (editCalls.length > 0) {
    const result = await applyEdits(backend, editCalls);
    successCount = result.successCount;
    errors = result.errors;

    if (errors.length > 0) {
      getLogger().warn(
        { errorCount: errors.length, errors },
        "Single-shot edit had failed tool calls"
      );
      rollbar.error(new Error(`Single-shot edit failures: ${errors.length}/${editCalls.length}`), {
        errors: errors.join("; "),
        successCount,
        totalEdits: editCalls.length,
      });
    }

    // Flush deferred writes to DB (only if at least one edit succeeded)
    if (successCount > 0) {
      await backend.flush();
    }
  }

  // Retry when ALL edits failed or LLM only called view (no actual mutations).
  // Partial success means some edits already modified the backend — don't retry.
  if (successCount === 0 && (errors.length > 0 || hadViewOnly)) {
    const retryReason = hadViewOnly
      ? "You used the view command, but all files are already pre-loaded in the system prompt above. Do NOT call view. Use str_replace to make your edits directly."
      : `Your edits failed with these errors:\n${errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}`;

    getLogger().info(
      { hadViewOnly, errorCount: errors.length },
      "All edits failed, retrying with feedback"
    );

    const retryResult = await retryWithErrorContext(
      backend,
      modelWithTools,
      invokeMessages,
      editCalls.length > 0 ? editCalls : toolCalls,
      [retryReason]
    );

    if (retryResult) {
      return retryResult;
    }

    // Retry also failed completely — signal escalation to full agent
    const failMessage = new AIMessage({
      content:
        "I attempted to make the changes but encountered errors applying the edits. Could you try rephrasing your request?",
    });
    const [failStructured] = await toStructuredMessage(failMessage);
    return { messages: [failStructured], status: "completed", allFailed: true };
  }

  // Build user-facing message based on edit outcomes
  const textContent = extractTextContent(response);
  let messageContent: string;

  if (errors.length > 0) {
    // SOME edits failed — append a warning to the LLM's text
    messageContent =
      (textContent || "I've made the requested changes.") +
      "\n\nNote: some edits could not be applied. You may want to verify the changes.";
  } else {
    // All edits succeeded — use original LLM text
    messageContent = textContent || "I've made the requested changes.";
  }

  const finalMessage = new AIMessage({ content: messageContent });
  const [structuredMessage] = await toStructuredMessage(finalMessage);
  return { messages: [structuredMessage], status: "completed" };
}

/**
 * Apply tool call edits to the backend, collecting successes and errors.
 */
async function applyEdits(
  backend: WebsiteFilesBackend,
  editCalls: Array<{ args: unknown }>
): Promise<{ successCount: number; errors: string[] }> {
  const errors: string[] = [];
  let successCount = 0;
  for (const toolCall of editCalls) {
    const result = await executeTextEditorCommand(
      backend,
      toolCall.args as unknown as TextEditorInput
    );
    if (result.startsWith("Error:")) {
      errors.push(result);
    } else {
      successCount++;
    }
  }
  return { successCount, errors };
}

/**
 * Retry failed edits by re-invoking the LLM with error context and current file contents.
 * Returns a successful result if the retry produces any successful edits, or null if retry
 * also fails completely.
 */
async function retryWithErrorContext(
  backend: WebsiteFilesBackend,
  model: any,
  originalMessages: BaseMessage[],
  failedCalls: Array<{ args: unknown }>,
  errors: string[]
): Promise<{ messages: BaseMessage[]; status: "completed" } | null> {
  // Collect unique file paths from failed edits and re-read their current contents
  const failedPaths = [...new Set(failedCalls.map((tc) => (tc.args as any)?.path).filter(Boolean))];

  const fileContents: string[] = [];
  for (const filePath of failedPaths) {
    try {
      const content = await backend.read(filePath);
      if (content) {
        fileContents.push(`### ${filePath}\n\`\`\`\n${content}\n\`\`\``);
      }
    } catch {
      // File may not exist — skip
    }
  }

  const retryParts = [errors.map((e, i) => `${i + 1}. ${e}`).join("\n")];
  if (fileContents.length > 0) {
    retryParts.push(
      `Here are the current file contents — use these to pick correct anchors:\n\n${fileContents.join("\n\n")}`
    );
  }
  retryParts.push("Use str_replace to make your edits. Do NOT call view.");

  const retryMessage = new HumanMessage(retryParts.join("\n\n"));

  try {
    const retryResponse = await model.invoke([...originalMessages, retryMessage]);
    const retryToolCalls = retryResponse.tool_calls ?? [];
    const retryEditCalls = retryToolCalls.filter((tc: any) => (tc.args as any)?.command !== "view");

    if (retryEditCalls.length === 0) {
      // LLM gave up or only called view again — signal failure for escalation
      getLogger().warn("Single-shot retry produced no edit calls");
      return null;
    }

    const { successCount: retrySuccessCount, errors: retryErrors } = await applyEdits(
      backend,
      retryEditCalls
    );

    if (retrySuccessCount === 0) {
      // Retry also failed completely
      getLogger().warn({ retryErrors }, "Single-shot retry also failed completely");
      return null;
    }

    // Flush deferred writes to DB
    await backend.flush();

    // At least some retry edits succeeded
    const retryText = extractTextContent(retryResponse);
    let messageContent = retryText || "I've made the requested changes.";
    if (retryErrors.length > 0) {
      messageContent +=
        "\n\nNote: some edits could not be applied. You may want to verify the changes.";
    }

    const finalMessage = new AIMessage({ content: messageContent });
    const [structuredMessage] = await toStructuredMessage(finalMessage);
    return { messages: [structuredMessage], status: "completed" };
  } catch (e) {
    getLogger().warn({ err: e }, "Single-shot retry LLM call failed");
    return null;
  }
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
