/**
 * Gradient recipes - tested combinations that look great.
 * Provides specific gradient patterns for different contexts.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getThemeMode } from "../themeUtils";

export const gradientRecipesPrompt: CodingPromptFn = async (
  state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => {
  const themeMode = getThemeMode(state);

  const darkGradients = `
### Dark Theme Gradients

**Hero Background with Glow:**
\`\`\`tsx
<section className="min-h-[80vh] bg-primary relative overflow-hidden">
  {/* Top-right glow */}
  <div className="absolute -top-20 -right-20 w-96 h-96 bg-secondary/30 rounded-full blur-3xl" />
  {/* Bottom-left glow */}
  <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-accent/20 rounded-full blur-3xl" />
  {/* Content */}
  <div className="relative z-10">...</div>
</section>
\`\`\`

**Gradient Mesh Background:**
\`\`\`tsx
<section className="bg-gradient-to-br from-primary via-primary to-[hsl(var(--primary)/0.8)] relative">
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--secondary)/0.15),transparent_50%)]" />
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--accent)/0.1),transparent_50%)]" />
</section>
\`\`\`

**Card with Subtle Glow:**
\`\`\`tsx
<div className="bg-card rounded-2xl p-6 border border-border shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20 transition-shadow">
\`\`\`

**Glowing Button:**
\`\`\`tsx
<button className="bg-secondary text-secondary-foreground px-8 py-4 rounded-full font-semibold shadow-lg shadow-secondary/30 hover:shadow-xl hover:shadow-secondary/40 hover:scale-105 transition-all">
\`\`\`

**Atmospheric Section:**
\`\`\`tsx
<section className="py-24 bg-background relative overflow-hidden">
  {/* Subtle top gradient */}
  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
  {/* Corner accents */}
  <div className="absolute top-10 right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
  <div className="absolute bottom-10 left-10 w-24 h-24 bg-secondary/5 rounded-full blur-xl" />
</section>
\`\`\`
`;

  const lightGradients = `
### Light Theme Gradients

**Soft Hero Background:**
\`\`\`tsx
<section className="min-h-[80vh] bg-gradient-to-br from-background via-muted/30 to-background relative overflow-hidden">
  {/* Soft blob */}
  <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
  {/* Content */}
  <div className="relative z-10">...</div>
</section>
\`\`\`

**Bold Primary Hero:**
\`\`\`tsx
<section className="min-h-[80vh] bg-primary relative overflow-hidden">
  {/* Light gradient overlay */}
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
</section>
\`\`\`

**Card with Depth:**
\`\`\`tsx
<div className="bg-card rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow border border-border/50">
\`\`\`

**Elevated Button:**
\`\`\`tsx
<button className="bg-primary text-primary-foreground px-8 py-4 rounded-full font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 transition-all">
\`\`\`

**Subtle Section Gradient:**
\`\`\`tsx
<section className="py-24 bg-gradient-to-b from-background via-muted/20 to-background">
\`\`\`

**Feature Section with Warmth:**
\`\`\`tsx
<section className="py-24 bg-muted relative">
  {/* Warm accent */}
  <div className="absolute top-0 left-1/4 w-1/3 h-32 bg-secondary/5 blur-3xl" />
</section>
\`\`\`
`;

  const universalGradients = `
## Gradient Recipes

Gradients add atmosphere and depth. Use these tested patterns.

### Universal Patterns

**Section Divider Line:**
\`\`\`tsx
<div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
\`\`\`

**Text Gradient (Use Sparingly):**
\`\`\`tsx
<span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
  Highlighted Text
</span>
\`\`\`

**Fade to Background (Bottom of Hero):**
\`\`\`tsx
<div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
\`\`\`

**Overlay for Text Readability:**
\`\`\`tsx
{/* On images or busy backgrounds */}
<div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
\`\`\`

### Atmospheric Orbs

**Large Background Orb:**
\`\`\`tsx
<div className="absolute -top-40 -right-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />
\`\`\`

**Small Accent Orb:**
\`\`\`tsx
<div className="absolute top-10 left-10 w-24 h-24 bg-primary/10 rounded-full blur-xl" />
\`\`\`

**Animated Floating Orb:**
\`\`\`tsx
<div className="absolute top-20 right-20 w-32 h-32 bg-accent/15 rounded-full blur-2xl animate-pulse" />
\`\`\`

### Gradient Don'ts

- ❌ Don't use more than 2-3 gradient orbs per section
- ❌ Don't make orbs too opaque (keep under /30)
- ❌ Don't use gradients on text unless it's a headline highlight
- ❌ Don't use rainbow gradients (stick to theme colors)
`;

  let result = universalGradients;
  if (themeMode === "dark") {
    result += darkGradients;
  } else if (themeMode === "light") {
    result += lightGradients;
  } else {
    // Include both if unknown
    result += lightGradients + darkGradients;
  }

  return result;
};
