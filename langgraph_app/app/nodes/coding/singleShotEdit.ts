import { AIMessage } from "@langchain/core/messages";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { getLLM } from "@core";
import { toStructuredMessage } from "langgraph-ai-sdk";
import { executeTextEditorCommand, type TextEditorInput } from "@tools";
import { getCodingAgentBackend, getTheme, type MinimalCodingAgentState } from "./agent";
import { buildFileTree, preReadFiles } from "./superlightEditAgent";
import { formatTypographyPrompt, type CodingPromptState } from "@prompts";
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

/**
 * Build condensed design guidance for the single-shot prompt.
 * Includes the most impactful subset of the full coding agent's design context:
 * theme colors, typography hierarchy, hover/animation patterns, and CSS variables.
 */
function buildDesignGuidance(theme?: CodingPromptState["theme"]): string {
  const sections: string[] = [];

  // Theme colors — most important for edits that touch colors/backgrounds
  sections.push(`## Theme Colors (shadcn)

Use semantic color classes. Each role has a background + matching text:
| Element | Background | Text on it |
|---------|-----------|------------|
| Page | bg-background | text-foreground |
| Primary (hero/CTAs) | bg-primary | text-primary-foreground |
| Secondary (buttons) | bg-secondary | text-secondary-foreground |
| Muted/subtle | bg-muted | text-muted-foreground |
| Accent (badges) | bg-accent | text-accent-foreground |
| Cards | bg-card | text-card-foreground |

Section backgrounds: ONLY use bg-background, bg-muted, or bg-primary for full-width sections. NEVER bg-secondary, bg-accent, or bg-card for sections.
Page rhythm: Hero=bg-primary → Features=bg-muted → Content=bg-background → CTA=bg-primary.
Cards on colored sections: use bg-card or bg-background for the card to create contrast.`);

  // CSS variable values — so the LLM knows what colors actually resolve to
  if (theme?.semanticVariables) {
    const vars = Object.entries(theme.semanticVariables)
      .map(([key, value]) => `  ${key}: ${value}`)
      .join("\n");
    sections.push(`## Current Theme CSS Variables (HSL values)\n${vars}`);
  }

  // Typography recommendations — theme-specific contrast guidance
  if (theme?.typography_recommendations) {
    sections.push(formatTypographyPrompt(theme.typography_recommendations, theme.colors));
  }

  // Typography sizes and spacing — common edit targets
  sections.push(`## Typography & Spacing

Headlines: Hero text-4xl md:text-5xl lg:text-7xl font-bold. Sections text-3xl md:text-4xl lg:text-5xl.
Body: text-base or text-lg. Muted text uses text-muted-foreground.
Section padding: py-16 md:py-20 lg:py-24. Element gaps: gap-4 md:gap-6 lg:gap-8.`);

  // Hover & animation patterns — edits often add/modify these
  sections.push(`## Hover & Transitions

Buttons: hover:scale-105 transition-all duration-200. Cards: hover:shadow-lg hover:-translate-y-1.
Use transition-all duration-200 for smooth interactions. Keep durations 200-400ms.`);

  // Tracking — condensed version of the full tracking prompt
  sections.push(`## Tracking (L10)

Import: \`import { L10 } from '@/lib/tracking'\`
Simple signup: \`L10.createLead(email).then(() => setStatus('success')).catch((e) => setError(e.message))\`
Tiered pricing: \`L10.createLead(email, { value: tierPrice })\`
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
 * Returns { messages, status } compatible with WebsiteGraphState.
 */
export async function singleShotEdit(
  state: MinimalCodingAgentState & { messages?: BaseMessage[] },
  contextMessages: BaseMessage[],
  existingBackend?: WebsiteFilesBackend
): Promise<{ messages: BaseMessage[]; status: "completed" }> {
  const backend = existingBackend ?? (await getCodingAgentBackend(state));

  // Pre-load source files into context: page components, pages, app root, CSS, libs.
  // Exclude ui/ library components (shadcn) — rarely edited and adds ~15K tokens of noise.
  const { tree, allPaths } = await buildFileTree(backend);
  const sourcePaths = allPaths.filter(
    (p) => p.includes("src/") && !p.includes("/components/ui/") && /\.(tsx?|css)$/.test(p)
  );
  console.log(`Pre-loading ${sourcePaths.length} source files`);
  const preReadContent = await preReadFiles(backend, sourcePaths);

  const systemMessage = buildSingleShotSystemMessage(tree, preReadContent);

  // Get LLM with usage tracking
  const llm = await getLLM({ skill: "coding", speed: "blazing", cost: "paid", maxTier: 3 });

  // Pass native text editor tool via withConfig — this flows through to
  // ChatAnthropic.invocationParams() which calls formatStructuredToolToAnthropic().
  // Using withConfig preserves configFactories (usage tracking) from getLLM().
  const modelWithTools = (llm as any).withConfig({
    tools: [NATIVE_TEXT_EDITOR_TOOL],
  });

  // Single-shot: one LLM call, apply all edits
  const invokeMessages: BaseMessage[] = [systemMessage, ...contextMessages];

  const response = await modelWithTools.invoke(invokeMessages);
  const toolCalls = response.tool_calls ?? [];

  console.log(`Single-shot: ${toolCalls.length} tool call(s)`);

  if (toolCalls.length === 0) {
    // No tool calls — LLM just responded with text
    const [structuredMessage] = await toStructuredMessage(response);
    return { messages: [structuredMessage], status: "completed" };
  }

  // Filter out "view" calls — all files are pre-loaded, view is a wasted call.
  // Only apply actual mutations (str_replace, create, insert).
  const editCalls = toolCalls.filter((tc: any) => (tc.args as any)?.command !== "view");

  if (editCalls.length === 0) {
    // LLM only called view (no actual edits) — return text response
    console.warn("Single-shot edit: LLM only used view commands, no edits applied");
    const [structuredMessage] = await toStructuredMessage(response);
    return { messages: [structuredMessage], status: "completed" };
  }

  // Apply edits — no retry on failure. Successful edits are already applied
  // to the backend (which syncs to Rails on each write). Failed str_replace
  // calls mean the LLM picked the wrong anchor; retrying the same input won't help.
  const errors: string[] = [];
  for (const toolCall of editCalls) {
    const result = await executeTextEditorCommand(
      backend,
      toolCall.args as unknown as TextEditorInput
    );
    if (result.startsWith("Error:")) {
      errors.push(result);
    }
  }

  if (errors.length > 0) {
    console.warn(`Single-shot edit had ${errors.length} failed tool call(s):`, errors);
  }

  // Return the text portion of the response as the user-facing message
  const textContent = extractTextContent(response);
  const finalMessage = new AIMessage({
    content: textContent || "I've made the requested changes.",
  });
  const [structuredMessage] = await toStructuredMessage(finalMessage);
  return { messages: [structuredMessage], status: "completed" };
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
