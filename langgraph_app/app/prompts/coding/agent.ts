/**
 * Main coding agent prompt builder.
 * Composes shared prompt components into a complete system prompt.
 */
import {
  contextPrompt,
  codingToolsPrompt,
  workflowPrompt,
  codeGuidelinesPrompt,
  trackingContextPrompt,
  fileStructurePrompt,
  themeColorsPrompt,
  environmentPrompt,
} from "./shared";

/**
 * Build the complete coding agent system prompt.
 * Includes all shared components for landing page development.
 */
export const buildCodingPrompt = (): string => {
  return `You are an expert landing page developer. You create high-converting landing pages that drive pre-sales signups.

${contextPrompt()}

${codingToolsPrompt()}

${workflowPrompt()}

${codeGuidelinesPrompt()}

${trackingContextPrompt()}

${fileStructurePrompt()}

${themeColorsPrompt()}

${environmentPrompt()}

Start by exploring the existing template structure with ls and glob, then create the landing page sections.`;
};
