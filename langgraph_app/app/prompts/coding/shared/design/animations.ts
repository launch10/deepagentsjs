/**
 * Animation and micro-interaction guidance for polished landing pages.
 * CSS-only animations that add life without complexity.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const animationsPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Animations: Add Polish and Life
Subtle animations make a page feel premium. Use CSS-only animations for performance.

### Animation Best Practices
**DO:**
- Use \`transition-all duration-200\` for micro-interactions
- Keep durations short: 200-400ms for interactions, 400-800ms for entrances
- Use \`ease-out\` for entrances, \`ease-in-out\` for loops
- Add subtle \`hover:scale-105\` to buttons
- Stagger entrance animations with \`animation-delay\`
**DON'T:**
- Animate everything - pick 3-5 key elements
- Use animations longer than 1s for interactions
- Make things bounce or shake unless intentional
- Distract from content with constant motion
- Forget to add \`transition-*\` classes for hover states

### Quick Animation Classes to Use
| Effect | Classes |
|--------|---------|
| Smooth transitions | \`transition-all duration-200\` |
| Hover lift | \`hover:-translate-y-1 hover:shadow-lg\` |
| Hover scale | \`hover:scale-105\` |
| Hover opacity | \`hover:opacity-80\` |
| Pulse | \`animate-pulse\` |
| Bounce | \`animate-bounce\` |
| Spin | \`animate-spin\` |
`;