/**
 * Bug fix prompt builder for the coding agent.
 * Uses shared components plus error context.
 */
import { codeGuidelinesPrompt } from "../shared";

/**
 * Build a system prompt for fixing runtime errors.
 */
export const buildBugFixPrompt = (errorContext: string): string => {
  return `You are fixing runtime errors in a landing page.

The user has a simple, static landing page that uses:
1. React Router
2. Tailwind
3. ShadCN

<task>
Fix the following errors:
</task>

<errors>
${errorContext}
</errors>

${codeGuidelinesPrompt()}

Analyze the errors and modify the code files to resolve them.`;
};
