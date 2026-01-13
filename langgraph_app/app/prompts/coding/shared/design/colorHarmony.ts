/**
 * Color harmony guidance for using the theme palette effectively.
 * Helps the agent understand how to combine colors for visual impact.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getThemeMode } from "../themeUtils";

export const colorHarmonyPrompt: CodingPromptFn = async (
  state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => {
  const themeMode = getThemeMode(state);

  const baseGuidance = `
## Color Harmony: Using Your Palette Effectively

Your theme has semantic color roles. Here's how to combine them for maximum impact.

### The 60-30-10 Rule

Balance colors across your page:
- **60% Dominant**: \`bg-background\`, \`bg-muted\` - Most of your page
- **30% Secondary**: \`bg-primary\`, \`bg-card\` - Key sections and containers
- **10% Accent**: \`text-secondary\`, \`bg-accent\` - Highlights and CTAs

### Color Role Usage

| Role | Best Used For | Avoid Using For |
|------|---------------|-----------------|
| **Primary** | Hero bg, CTA sections, footer, main buttons | Every button, small badges |
| **Secondary** | Highlighted text, accent buttons, badges | Large section backgrounds |
| **Accent** | Hover states, small highlights, icons | Section backgrounds, body text |
| **Muted** | Alternating sections, subtle cards | Hero sections, CTAs |

### Creating Visual Hierarchy with Color

**Headlines that pop:**
\`\`\`tsx
// Highlight key word with secondary color
<h1 className="text-4xl font-bold">
  Build <span className="text-secondary">faster</span> than ever
</h1>

// Or use primary on light backgrounds
<h1 className="text-4xl font-bold text-primary">
  The Future is Here
</h1>
\`\`\`

**Buttons with clear hierarchy:**
\`\`\`tsx
// Primary action - most prominent
<button className="bg-primary text-primary-foreground">Get Started</button>

// Secondary action - less prominent
<button className="bg-secondary text-secondary-foreground">Learn More</button>

// Tertiary/ghost action - subtle
<button className="text-foreground hover:text-primary">Skip for now</button>
\`\`\`

### Section Color Rhythm

Create visual flow by alternating backgrounds:

\`\`\`
Hero:     bg-primary    ████████████████████████
Features: bg-muted      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
Social:   bg-background ░░░░░░░░░░░░░░░░░░░░░░░░
Pricing:  bg-muted      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
CTA:      bg-primary    ████████████████████████
Footer:   bg-primary    ████████████████████████
\`\`\`

### Color Combinations That Work

**On bg-primary sections:**
- Cards: \`bg-card\` or \`bg-background\` (creates contrast)
- Text: \`text-primary-foreground\`
- Highlights: \`text-secondary\` or \`bg-secondary\`

**On bg-background sections:**
- Cards: \`bg-card\` with shadow
- Accents: \`text-primary\`, \`text-secondary\`
- Borders: \`border-border\` or \`border-primary/20\`

**On bg-muted sections:**
- Cards: \`bg-card\` (slightly lighter)
- Text: \`text-foreground\`, \`text-muted-foreground\`
- Accents: \`bg-primary\` for buttons

### Color Don'ts

- ❌ Don't use \`bg-secondary\` or \`bg-accent\` for full sections
- ❌ Don't put cards with the same background as the section
- ❌ Don't use more than 2 vibrant colors in the same view
- ❌ Don't forget text contrast (always pair bg-X with text-X-foreground)
`;

  const darkModeAddition = `

### Dark Theme Color Tips

On dark themes, colors appear more vibrant. Use this to your advantage:

- **Glowing effects**: \`bg-secondary/20\` creates beautiful glows
- **Text accents**: \`text-secondary\` pops more than on light themes
- **Opacity layers**: \`bg-primary/10\` adds subtle depth
- **Borders**: \`border-primary/30\` adds definition without harshness

\`\`\`tsx
// Glowing button on dark
<button className="bg-secondary text-secondary-foreground shadow-lg shadow-secondary/25">
  Get Started
</button>

// Card with subtle glow
<div className="bg-card rounded-2xl p-6 border border-primary/20 shadow-lg shadow-primary/10">
\`\`\`
`;

  const lightModeAddition = `

### Light Theme Color Tips

On light themes, use color strategically for emphasis:

- **Primary sections**: Bold \`bg-primary\` creates strong anchors
- **Shadows**: Use shadows more than color for depth
- **Subtle gradients**: \`from-background via-muted/50 to-background\`
- **Color accents**: Reserve vibrant colors for CTAs and highlights

\`\`\`tsx
// Card with shadow depth
<div className="bg-card rounded-2xl p-6 shadow-md hover:shadow-xl transition-shadow">

// Subtle gradient section
<section className="bg-gradient-to-br from-background via-primary/5 to-background">

// Accent border
<div className="border-l-4 border-primary pl-4">
\`\`\`
`;

  let result = baseGuidance;
  if (themeMode === "dark") {
    result += darkModeAddition;
  } else if (themeMode === "light") {
    result += lightModeAddition;
  }

  return result;
};
