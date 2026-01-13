/**
 * Theme color utilities available in landing pages.
 * Follows shadcn/ui conventions.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
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
| Primary (CTAs) | bg-primary | text-primary-foreground |
| Secondary | bg-secondary | text-secondary-foreground |
| Muted/subtle | bg-muted | text-muted-foreground |
| Accent | bg-accent | text-accent-foreground |
| Cards | bg-card | text-card-foreground |
| Destructive | bg-destructive | text-destructive-foreground |

For subdued text on the page background, use \`text-muted-foreground\`.

You should try to vary the background colors of subsequent sections, so that the page is not monotonous. 

See the typography instructions for recommendations on which colors go well with which background colors.
`;
