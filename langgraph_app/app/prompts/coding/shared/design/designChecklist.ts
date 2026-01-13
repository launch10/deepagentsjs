/**
 * Design quality checklist - self-review before completion.
 * Ensures the agent validates design quality before finishing.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getThemeMode } from "./themeUtils";

export const designChecklistPrompt: CodingPromptFn = async (
  state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => {
  const themeMode = getThemeMode(state);

  return `
## Design Quality Checklist

**Before completing the landing page, verify these design quality gates:**

### Visual Impact (Must Pass)

- [ ] **Hero makes an impression**: Not just centered text on white
  - Has bg-primary OR dramatic gradient
  - Headline is text-4xl+ (ideally text-5xl to text-7xl)
  - Has atmospheric elements (orbs, gradients, patterns)

- [ ] **Section rhythm exists**: Backgrounds alternate
  - Not all sections are bg-background
  - Uses bg-primary for at least hero and CTA
  - Uses bg-muted for contrast sections

- [ ] **Cards have depth**: Not invisible on their sections
  - Cards use bg-card on bg-muted sections
  - Cards use bg-card or bg-background on bg-primary sections
  - Cards have rounded-2xl or rounded-3xl

### Typography (Must Pass)

- [ ] **Headlines are bold**: Not timid text-2xl
  - Hero: text-4xl md:text-5xl lg:text-7xl
  - Sections: text-3xl md:text-4xl lg:text-5xl
  - Uses font-bold or font-semibold

- [ ] **Text hierarchy is clear**:
  - Headlines > Subheadlines > Body > Captions
  - Muted text uses text-muted-foreground
  - Key words highlighted with text-secondary or text-primary

### Spacing (Must Pass)

- [ ] **Generous whitespace**: Not cramped
  - Section padding: py-16 md:py-20 lg:py-24
  - Element gaps: gap-4 md:gap-6 lg:gap-8
  - Container padding: px-4 md:px-6

- [ ] **Responsive breakpoints**: Mobile-first
  - All text sizes have responsive variants
  - Grid columns adapt (grid-cols-1 → md:grid-cols-2 → lg:grid-cols-3)
  - Spacing increases on larger screens

### Visual Interest (Should Pass)

- [ ] **Interactive elements respond**: Not static
  - Buttons: hover:scale-105 or hover:bg-X transition
  - Cards: hover:shadow-lg or hover:-translate-y-1
  - Links: hover:text-primary

- [ ] **One memorable thing exists**:
  - A distinctive hero treatment
  - An unusual layout choice
  - A creative use of color
  - Something someone would remember after 3 seconds

${themeMode === "dark" ? `
### Dark Theme Specifics

- [ ] Uses glowing effects: shadow-lg shadow-primary/20
- [ ] Atmospheric orbs: bg-secondary/20 rounded-full blur-3xl
- [ ] Subtle borders for definition: border border-border
` : ""}

${themeMode === "light" ? `
### Light Theme Specifics

- [ ] Cards have shadows: shadow-md or shadow-lg
- [ ] Subtle gradients for atmosphere: from-background via-muted/30
- [ ] Clean, professional appearance
` : ""}

### Red Flags (Automatic Fail)

If ANY of these exist, fix them before completing:

❌ All sections have bg-background (flat, boring)
❌ Hero headline is text-2xl or smaller (weak)
❌ Section padding is py-12 or less (cramped)
❌ Cards have same background as section (invisible)
❌ No hover effects anywhere (static, lifeless)
❌ Using bg-secondary or bg-accent for full sections (jarring)
❌ Identical card sizes in a perfect grid (generic)
❌ Generic CTAs like "Get Started" without context

### Quality Gate

Before calling the task complete, mentally score the page:

| Aspect | Score (1-5) |
|--------|-------------|
| Would I remember this after 3 seconds? | ___ |
| Does it look like a real SaaS landing page? | ___ |
| Is there visual variety and rhythm? | ___ |
| Are the CTAs compelling and specific? | ___ |

**If any score is below 3, improve that aspect before completing.**
`;
};
