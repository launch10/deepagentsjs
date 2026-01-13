/**
 * Design direction prompt for creating distinctive, bold landing pages.
 * Inspired by Anthropic's frontend-design skill.
 * Encourages memorable aesthetics over generic "AI slop".
 * Now theme-aware: gives different guidance for dark vs light themes.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getThemeMode } from "../themeUtils";

const darkThemeGuidance = `
### Your Theme: DARK MODE

Your theme has a dark background. This is an opportunity for **dramatic, atmospheric** design.

**Dark theme strengths to leverage:**
- Glowing accents pop beautifully against dark backgrounds
- Gradient orbs and blur effects create stunning depth
- White/light text has natural contrast and elegance
- Primary colors can be used more boldly as accents

**Recommended approach:**
- Hero: Use bg-primary with glowing secondary accents
- Backgrounds: Deep gradients with subtle texture (dots, grid)
- Cards: Slightly lighter than background for subtle lift
- Atmospheric elements: Glowing orbs, star patterns, subtle light effects

**Code patterns for dark:**
\`\`\`tsx
// Hero with glow
<section className="bg-primary relative overflow-hidden">
  <div className="absolute top-20 right-10 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />
  <div className="absolute bottom-10 left-20 w-48 h-48 bg-accent/15 rounded-full blur-2xl" />
</section>

// Dark gradient background
<section className="bg-gradient-to-b from-[#0a0a1a] via-background to-background">
\`\`\`
`;

const lightThemeGuidance = `
### Your Theme: LIGHT MODE

Your theme has a light background. Focus on **clean, elegant** design with strategic color accents.

**Light theme strengths to leverage:**
- Clean, professional appearance
- Primary color sections create strong contrast
- Subtle shadows and depth effects
- Typography hierarchy is easily readable

**Recommended approach:**
- Hero: Bold bg-primary OR clean bg-background with accent elements
- Backgrounds: Subtle gradients, soft shadows for depth
- Cards: White with subtle shadows for lift
- Atmospheric elements: Soft gradients, subtle blurs, muted orbs

**Code patterns for light:**
\`\`\`tsx
// Clean hero with subtle gradient
<section className="bg-gradient-to-br from-background via-muted/30 to-background relative">
  <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />
</section>

// Bold primary hero (recommended for impact)
<section className="bg-primary text-primary-foreground">
  {/* Light text on dark primary background */}
</section>

// Card with subtle lift
<div className="bg-card rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow">
\`\`\`
`;

const baseGuidance = `
## Design Direction: Be Bold, Be Memorable

You are creating a landing page that should be **distinctive and memorable**, not generic "AI slop".

### Before Coding: Choose Your Aesthetic

Commit to a BOLD design direction. Pick one tone and execute it with precision:
- **Minimalist/Editorial**: Generous whitespace, elegant typography, restrained color
- **Dark/Dramatic**: Rich dark backgrounds, glowing accents, atmospheric depth
- **Soft/Organic**: Rounded shapes, pastel tones, gentle gradients
- **Bold/Playful**: Vibrant colors, asymmetric layouts, creative typography
- **Luxury/Refined**: Deep jewel tones, gold accents, sophisticated typography
- **Tech/Modern**: Gradient meshes, glass morphism, subtle animations

### Typography: Be Distinctive

**NEVER** use generic fonts like Inter, Arial, or Roboto for headlines.

Good font pairings (use Google Fonts):
- Headlines: \`Playfair Display\`, \`Sora\`, \`Space Grotesk\`, \`DM Serif Display\`, \`Fraunces\`
- Body: \`DM Sans\`, \`Plus Jakarta Sans\`, \`Source Sans 3\`, \`IBM Plex Sans\`

**Creative typography techniques:**
- Highlight key words in accent color: "Test 10 Business Ideas in <span class="text-secondary">10 Minutes</span>"
- Use different font weights for emphasis
- Larger-than-expected headlines (text-5xl to text-7xl)

### Layout: Break the Grid

**Asymmetry creates interest:**
- Hero with illustration offset to one side
- Features in varied card sizes
- Overlapping elements with z-index

**Section variety:**
- Full-bleed \`bg-primary\` sections for impact (hero, CTA)
- \`bg-muted\` sections for subtle contrast
- Cards that "pop" off colored backgrounds

### The One Memorable Thing

Every landing page needs ONE thing someone will remember:
- A distinctive hero illustration or animation
- An unusual layout choice
- A creative use of the accent color
- A surprising typographic treatment

**Ask yourself:** If someone looked at this page for 3 seconds, what would they remember?

### What to AVOID (Generic AI Slop)

- Perfectly centered, symmetrical everything
- Default white background with no atmosphere
- Inter/Arial/system fonts
- Evenly-distributed pastel colors
- Stock photo placeholders
- Generic "Get Started" / "Learn More" CTAs
- Safe, forgettable choices

### Remember

Bold minimalism AND bold maximalism both work. The key is **intentionality**.
Make a choice. Commit to it. Execute with precision.
`;

export const designDirectionPrompt: CodingPromptFn = async (
  state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => {
  const themeMode = getThemeMode(state);

  let themeSpecificGuidance = "";
  if (themeMode === "dark") {
    themeSpecificGuidance = darkThemeGuidance;
  } else if (themeMode === "light") {
    themeSpecificGuidance = lightThemeGuidance;
  }

  return baseGuidance + themeSpecificGuidance;
};
