/**
 * Surface harmony guidance - which backgrounds work together.
 * Prevents card-on-same-color and other surface conflicts.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getThemeMode } from "../themeUtils";

export const surfaceHarmonyPrompt: CodingPromptFn = async (
  state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => {
  const themeMode = getThemeMode(state);

  return `
## Surface Harmony: Containers Within Containers

Understanding which backgrounds work together is critical for visual hierarchy.

### The Surface Hierarchy

\`\`\`
Level 0: Page (bg-background)
Level 1: Sections (bg-background, bg-muted, bg-primary)
Level 2: Cards (bg-card, bg-background on colored sections)
Level 3: Nested elements (input fields, hover states)
\`\`\`

### Surface Pairing Rules

| Section Background | Card Background | Why It Works |
|--------------------|-----------------|--------------|
| \`bg-background\` | \`bg-card\` | Card is slightly different, creates subtle lift |
| \`bg-muted\` | \`bg-card\` | Card pops against muted |
| \`bg-primary\` | \`bg-card\` or \`bg-background\` | Strong contrast, card stands out |
| \`bg-primary\` | \`bg-primary-foreground/10\` | Subtle glass effect |

### What NEVER Works

| Section | Card | Problem |
|---------|------|---------|
| \`bg-muted\` | \`bg-muted\` | Invisible cards |
| \`bg-card\` | \`bg-card\` | No depth perception |
| \`bg-background\` | \`bg-background\` | Flat, no hierarchy |
| \`bg-primary\` | \`bg-primary\` | Cards disappear |

### Practical Examples

**Cards on bg-background section:**
\`\`\`tsx
<section className="py-24 bg-background">
  <div className="grid md:grid-cols-3 gap-6">
    {items.map((item) => (
      <div className="bg-card rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
        {/* Card content */}
      </div>
    ))}
  </div>
</section>
\`\`\`

**Cards on bg-muted section:**
\`\`\`tsx
<section className="py-24 bg-muted">
  <div className="grid md:grid-cols-3 gap-6">
    {items.map((item) => (
      <div className="bg-card rounded-2xl p-6">
        {/* Shadow optional - muted already provides contrast */}
      </div>
    ))}
  </div>
</section>
\`\`\`

**Cards on bg-primary section (hero/CTA):**
\`\`\`tsx
<section className="py-24 bg-primary">
  <div className="grid md:grid-cols-3 gap-6">
    {items.map((item) => (
      <div className="bg-card text-card-foreground rounded-2xl p-6">
        {/* Strong contrast - cards really pop */}
      </div>
    ))}
  </div>
</section>
\`\`\`

${themeMode === "dark" ? `
### Dark Theme Surface Tips

On dark themes, use semi-transparent overlays for subtle depth:

\`\`\`tsx
{/* Glass card on primary */}
<div className="bg-background/10 backdrop-blur-sm border border-primary-foreground/10 rounded-2xl p-6">

{/* Elevated card on background */}
<div className="bg-card rounded-2xl p-6 border border-border">

{/* Glowing card */}
<div className="bg-card rounded-2xl p-6 shadow-lg shadow-primary/10">
\`\`\`
` : ""}

${themeMode === "light" ? `
### Light Theme Surface Tips

On light themes, shadows create depth more than color:

\`\`\`tsx
{/* Card with shadow hierarchy */}
<div className="bg-card rounded-2xl p-6 shadow-sm">      {/* Normal */}
<div className="bg-card rounded-2xl p-6 shadow-md">      {/* Elevated */}
<div className="bg-card rounded-2xl p-6 shadow-lg">      {/* Floating */}

{/* Hover elevation */}
<div className="bg-card rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow">
\`\`\`
` : ""}

### Nested Containers

When nesting containers, always step DOWN in the hierarchy:

\`\`\`tsx
{/* Section → Card → Input */}
<section className="bg-muted">
  <div className="bg-card rounded-2xl p-6">
    <input className="bg-background border border-border rounded-lg px-4 py-2" />
  </div>
</section>

{/* Section → Card → Badge */}
<section className="bg-background">
  <div className="bg-card rounded-2xl p-6">
    <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm">
      Badge
    </span>
  </div>
</section>
\`\`\`

### Quick Reference

- **Need contrast?** Move to a different surface level
- **Cards invisible?** Section and card are same color - change one
- **Too busy?** Reduce number of different surfaces in view
- **No depth?** Add shadow (light theme) or border (dark theme)
`;
};
