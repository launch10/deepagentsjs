/**
 * Code guidelines for landing page development.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const codeGuidelinesPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Code Guidelines

- Use shadcn/ui components from the template as your foundation
- Use theme color utilities for main elements (bg-primary, text-secondary-foreground, etc.)
- For gradients and atmospheric effects, you MAY use:
  - Opacity variants: \`bg-primary/20\`, \`text-accent/80\`
  - Gradient stops: \`from-background via-muted to-background\`
  - Raw hex for dark/atmospheric backgrounds ONLY: \`from-[#0a0a1a]\`
- One component per file, under 150 lines
- Prefer CSS-only animations where possible
- **ALWAYS use named exports, NEVER default exports.** The export name MUST match the file name.
  - Example: \`Hero.tsx\` → \`export function Hero() { ... }\`
  - Example: \`PricingCard.tsx\` → \`export function PricingCard() { ... }\`
  - NEVER: \`export default function() { ... }\` or \`export default Hero\`
- **ALWAYS use named imports** matching the component file name:
  - \`import { Hero } from "./Hero"\`
  - NEVER: \`import Hero from "./Hero"\`
`;
