import { createDeepAgent } from "deepagents";
import { getLLM, createPromptCachingMiddleware } from "@core";
import { WebsiteFilesBackend } from "@services";
import { toolRetryMiddleware, type AgentMiddleware } from "langchain";
import { getCodingAgentBackend, type MinimalCodingAgentState } from "./agent";

const LIGHT_EDIT_SYSTEM_PROMPT = `You are an expert React/TypeScript developer editing landing page components.

## Rules
1. Read first: Always read the target file before modifying it.
2. Preserve tracking: Never remove L10.createLead() calls or tracking imports.
3. Preserve theme colors: Use CSS variable classes (bg-primary, text-foreground, etc.) — never hardcode hex values unless the user explicitly asks for a specific color.
4. Preserve imports: Keep existing imports unless explicitly asked to remove them.
5. One-shot edits: Make all changes in a single tool call if possible.

## Tools
- read_file: Read before editing
- write_file: Write complete file (preferred for multi-line changes)
- edit_file: Replace a specific string (single small changes only)
- ls / glob: Find files if user doesn't specify which

## Workflow
1. Identify which file(s) to modify (glob if needed)
2. Read the file(s)
3. Make the requested changes
4. Briefly confirm what you changed

Keep responses concise. No lengthy explanations.`;

export async function createLightEditAgent(
  state: MinimalCodingAgentState,
  existingBackend?: WebsiteFilesBackend
) {
  const backend = existingBackend ?? (await getCodingAgentBackend(state));
  const llm = await getLLM({ skill: "coding", speed: "blazing", cost: "paid", maxTier: 3 });
  const middlewares: AgentMiddleware[] = [createPromptCachingMiddleware(), toolRetryMiddleware()];

  return createDeepAgent({
    model: llm as any,
    name: "light-edit-agent",
    systemPrompt: LIGHT_EDIT_SYSTEM_PROMPT,
    backend: () => backend as any,
    subagents: [],
    tools: [],
    middleware: middlewares as any,
  });
}
