import { createAgent } from "langchain";
import { createFilesystemMiddleware } from "deepagents";
import { getLLM, createPromptCachingMiddleware } from "@core";
import { WebsiteFilesBackend } from "@services";
import { type AgentMiddleware } from "langchain";
import { getCodingAgentBackend, type MinimalCodingAgentState } from "./agent";

/**
 * Map of component keywords → likely file name fragments.
 * Used to pre-read target files so the agent can edit in one shot.
 */
const COMPONENT_KEYWORDS: Record<string, string[]> = {
  hero: ["hero"],
  header: ["hero", "header"],
  banner: ["hero"],
  features: ["features"],
  feature: ["features"],
  benefits: ["features"],
  cta: ["cta"],
  "call to action": ["cta"],
  footer: ["footer"],
  pricing: ["pricing"],
  "how it works": ["howitworks", "how-it-works"],
  testimonial: ["testimonial", "socialproof", "social-proof"],
  "social proof": ["socialproof", "social-proof"],
  faq: ["faq"],
  problem: ["problem"],
  nav: ["nav"],
};

/**
 * Detect which component files the user likely wants to edit.
 * Returns matching file paths from the project.
 */
function detectTargetFiles(userMessage: string, filePaths: string[]): string[] {
  const msgLower = userMessage.toLowerCase();
  const matched = new Set<string>();

  for (const [keyword, fragments] of Object.entries(COMPONENT_KEYWORDS)) {
    if (msgLower.includes(keyword)) {
      for (const fragment of fragments) {
        for (const fp of filePaths) {
          if (fp.toLowerCase().includes(fragment)) {
            matched.add(fp);
          }
        }
      }
    }
  }

  // If nothing matched, include all component files (they're usually small)
  if (matched.size === 0) {
    for (const fp of filePaths) {
      if (fp.includes("src/components/")) {
        matched.add(fp);
      }
    }
  }

  return [...matched];
}

/**
 * Build the file tree string from globInfo results.
 */
async function buildFileTree(backend: WebsiteFilesBackend): Promise<{
  tree: string;
  allPaths: string[];
}> {
  const files = await backend.globInfo("**/*");
  const allPaths = files.map((f) => f.path);
  const tree = files
    .map((f) => {
      const sizeStr = f.size ? ` (${f.size} bytes)` : "";
      return `${f.path}${sizeStr}`;
    })
    .join("\n");
  return { tree, allPaths };
}

/**
 * Pre-read target files and format them for the system prompt.
 */
async function preReadFiles(
  backend: WebsiteFilesBackend,
  filePaths: string[]
): Promise<string> {
  const sections: string[] = [];
  for (const fp of filePaths) {
    try {
      const content = await backend.read(fp);
      sections.push(`### ${fp}\n\`\`\`tsx\n${content}\n\`\`\``);
    } catch {
      // File may not exist; skip silently
    }
  }
  return sections.join("\n\n");
}

function buildSystemPrompt(fileTree: string, preReadContent: string): string {
  return `You are an expert React/TypeScript developer editing landing page components.

## Rules
1. Preserve tracking: Never remove L10.createLead() calls or tracking imports.
2. Preserve theme colors: Use CSS variable classes (bg-primary, text-foreground, etc.) — never hardcode hex values unless the user explicitly asks for a specific color.
3. Preserve imports: Keep existing imports unless explicitly asked to remove them.
4. Minimal edits: Use edit_file to replace only the lines that change. Use write_file only when rewriting most of the file.

## Tools
- edit_file: Replace a specific string in a file (PREFERRED for changes)
- write_file: Write the complete file (only when most lines change)
- read_file: Read a file if you need more context beyond what's pre-loaded below

## Workflow
1. Review the pre-loaded file(s) below
2. Make the requested changes using edit_file (or write_file if rewriting most of the file)
3. Briefly confirm what you changed

Keep responses concise. No lengthy explanations. Do NOT use ls or glob — the file tree is below.

## Project File Tree
${fileTree}

## Pre-loaded Files
${preReadContent}`;
}

export async function createLightEditAgent(
  state: MinimalCodingAgentState & { messages?: Array<{ content: string | unknown }> },
  options?: {
    backend?: WebsiteFilesBackend;
    systemPrompt?: string;
  }
) {
  const backend = options?.backend ?? (await getCodingAgentBackend(state));
  const llm = await getLLM({ skill: "coding", speed: "blazing", cost: "paid", maxTier: 3 });

  let systemPrompt: string;
  if (options?.systemPrompt) {
    // Custom prompt (e.g. analytics node) — skip pre-injection
    systemPrompt = options.systemPrompt;
  } else {
    // Default: pre-inject file tree + target files so agent can edit in one shot
    const { tree, allPaths } = await buildFileTree(backend);
    const lastMsg = state.messages?.at(-1);
    const userText =
      lastMsg && typeof lastMsg.content === "string" ? lastMsg.content : "";
    const targetPaths = detectTargetFiles(userText, allPaths);
    const preReadContent = await preReadFiles(backend, targetPaths);
    systemPrompt = buildSystemPrompt(tree, preReadContent);
  }

  const fsMiddleware = createFilesystemMiddleware({
    backend: () => backend,
    systemPrompt: null, // Suppress the default FS middleware system prompt
  });

  const middlewares: AgentMiddleware[] = [
    createPromptCachingMiddleware(),
    fsMiddleware as any,
  ];

  return createAgent({
    model: llm as any,
    tools: [],
    name: "light-edit-agent",
    systemPrompt,
    middleware: middlewares as any,
  });
}
