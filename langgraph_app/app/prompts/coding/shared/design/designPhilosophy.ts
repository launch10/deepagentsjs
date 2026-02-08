/**
 * Design philosophy prompt - bold aesthetic direction for landing pages.
 * Reads from the frontend-design skill (.deepagents/skills/frontend-design/SKILL.md)
 * so there's a single source of truth for design guidelines.
 * Lives in the static/cached prompt prefix (free after first call within 5-min cache window).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

const SKILL_PATH = resolve(process.cwd(), ".deepagents/skills/frontend-design/SKILL.md");

// Read once at module load — this is static content
const skillContent = readFileSync(SKILL_PATH, "utf-8")
  // Strip YAML frontmatter
  .replace(/^---[\s\S]*?---\n*/, "")
  // Strip the "The user provides..." preamble (not relevant for the agent prompt)
  .replace(/^The user provides[\s\S]*?\n\n/, "")
  .trim();

export const designPhilosophyPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `## Design Philosophy\n\n${skillContent}`;
