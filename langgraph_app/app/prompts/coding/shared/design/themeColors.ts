/**
 * Theme color utilities available in landing pages.
 * Follows shadcn/ui conventions.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const themeColorsPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Theme Colors (shadcn standard)

Use semantic color classes. Each role has a background and matching text color:

| Element | Background | Text on it |
|---------|------------|------------|
| Page | bg-background | text-foreground |
| Primary (hero/CTAs) | bg-primary | text-primary-foreground |
| Secondary (buttons) | bg-secondary | text-secondary-foreground |
| Muted/subtle | bg-muted | text-muted-foreground |
| Accent (badges) | bg-accent | text-accent-foreground |
| Cards | bg-card | text-card-foreground |

For subdued text on the page background, use \`text-muted-foreground\`.

### Section Backgrounds (IMPORTANT)

Only these are suitable for full-width SECTION backgrounds:
- **bg-background**: Default for most sections (clean, neutral)
- **bg-muted**: Subtle variation (great for alternating sections)
- **bg-primary**: DRAMATIC sections - use for hero, CTA, or footer to create visual impact

**NEVER** use bg-secondary, bg-accent, or bg-card as full-width section backgrounds. They're for small elements like buttons and badges.

### Recommended Page Rhythm

Create visual interest by alternating section backgrounds:
1. **Hero**: \`bg-primary\` (bold, attention-grabbing) with \`text-primary-foreground\`
2. **Features**: \`bg-muted\` (subtle contrast from hero)
3. **Social proof**: \`bg-background\` (clean, let content shine)
4. **Pricing**: \`bg-muted\` OR \`bg-background\`
5. **CTA**: \`bg-primary\` (bookend with hero - LOUD call to action)
6. **Footer**: \`bg-primary\` or \`bg-muted\`

### Cards Inside Colored Sections

When placing cards inside a \`bg-primary\` or \`bg-muted\` section:
- Use \`bg-card\` or \`bg-background\` for the card itself
- This creates the "lifted" card effect with proper contrast
- **Never** use the same background color for both section and cards

See the typography instructions for text color recommendations.
`;
