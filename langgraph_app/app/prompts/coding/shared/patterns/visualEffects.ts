/**
 * Visual effects library with copy-paste patterns for gradients, shadows, and decorative elements.
 * These create the "atmosphere" that makes landing pages memorable.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const visualEffectsPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Visual Effects Library

Use these patterns to create atmosphere and depth. Mix and match based on your aesthetic.

### Gradient Backgrounds

**Dark dramatic (for bg-primary sections):**
\`\`\`tsx
// Deep space gradient
className="bg-gradient-to-b from-[#0a0a1a] via-[#0d1429] to-[#0a0a1a]"

// Midnight blue
className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]"

// Warm dark (for warm palettes)
className="bg-gradient-to-b from-[#1a0a0a] via-[#2d1414] to-[#1a0a0a]"

// Purple haze
className="bg-gradient-to-br from-[#0a0612] via-[#1a0d2e] to-[#0a0612]"
\`\`\`

**Light ethereal (for bg-background sections):**
\`\`\`tsx
// Subtle warmth
className="bg-gradient-to-br from-background via-orange-50/30 to-background"

// Cool mist
className="bg-gradient-to-b from-background via-blue-50/20 to-background"

// Soft lavender
className="bg-gradient-to-br from-background via-purple-50/20 to-background"
\`\`\`

**Mesh gradients (modern/tech aesthetic):**
\`\`\`tsx
// Multi-point gradient
className="bg-[radial-gradient(ellipse_at_top_right,rgba(var(--primary),0.15),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(var(--secondary),0.1),transparent_50%)]"
\`\`\`

### Atmospheric Orbs

**Floating glow elements (position these with absolute):**
\`\`\`tsx
// Large primary glow (top right)
<div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

// Secondary accent (bottom left)
<div className="absolute -bottom-24 -left-24 w-64 h-64 bg-secondary/15 rounded-full blur-3xl pointer-events-none" />

// Small accent dot
<div className="absolute top-1/2 right-1/4 w-32 h-32 bg-accent/25 rounded-full blur-2xl pointer-events-none" />

// Animated glow
<div className="absolute top-20 right-10 w-48 h-48 bg-primary/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
\`\`\`

**Multiple orbs for depth:**
\`\`\`tsx
<section className="relative overflow-hidden">
  {/* Background orbs - always add overflow-hidden to parent */}
  <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
  <div className="absolute top-1/2 -left-20 w-60 h-60 bg-secondary/10 rounded-full blur-3xl" />
  <div className="absolute -bottom-20 right-1/4 w-40 h-40 bg-accent/15 rounded-full blur-2xl" />

  {/* Content with relative z-10 */}
  <div className="relative z-10">
    {/* Your content */}
  </div>
</section>
\`\`\`

### Patterns and Textures

**Dot grid:**
\`\`\`tsx
// Light dots on dark
className="bg-[radial-gradient(circle,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:24px_24px]"

// Dark dots on light
className="bg-[radial-gradient(circle,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"
\`\`\`

**Grid lines:**
\`\`\`tsx
// Subtle grid
className="bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]"
\`\`\`

**Noise texture (add as overlay):**
\`\`\`tsx
// Noise overlay div
<div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-[0.015] pointer-events-none" />

// Or use a subtle grain
<div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent pointer-events-none" />
\`\`\`

### Shadow Systems

**Card shadows:**
\`\`\`tsx
// Subtle lift
className="shadow-sm hover:shadow-md transition-shadow"

// Dramatic lift
className="shadow-lg hover:shadow-2xl transition-shadow"

// Colored shadow (matches primary)
className="shadow-lg shadow-primary/20"

// Inset for depth
className="shadow-inner bg-muted/50"
\`\`\`

**Text shadows (for text on images/gradients):**
\`\`\`tsx
// Subtle text shadow
style={{ textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}

// Strong shadow for readability
style={{ textShadow: '0 4px 20px rgba(0,0,0,0.5)' }}
\`\`\`

### Glass Morphism

**Frosted glass cards:**
\`\`\`tsx
// Glass card
className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl"

// Glass on dark
className="bg-black/20 backdrop-blur-md border border-white/10 rounded-xl"

// Subtle glass
className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-lg"
\`\`\`

### Border Effects

**Gradient borders:**
\`\`\`tsx
// Gradient border using background
<div className="p-[1px] bg-gradient-to-r from-primary via-secondary to-accent rounded-2xl">
  <div className="bg-background rounded-2xl p-6">
    {/* Content */}
  </div>
</div>
\`\`\`

**Glow borders:**
\`\`\`tsx
// Glowing border effect
className="border border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
\`\`\`

### Decorative Elements

**Floating shapes:**
\`\`\`tsx
// Geometric accent
<div className="absolute top-20 right-10 w-20 h-20 border-2 border-primary/20 rounded-xl rotate-12" />

// Circle decoration
<div className="absolute bottom-10 left-1/4 w-4 h-4 bg-secondary rounded-full" />

// Line accent
<div className="absolute top-1/2 right-0 w-32 h-[2px] bg-gradient-to-l from-primary to-transparent" />
\`\`\`

**Dividers with style:**
\`\`\`tsx
// Gradient divider
<div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

// Thick accent divider
<div className="w-20 h-1 bg-primary rounded-full mx-auto" />
\`\`\`

### Quick Reference: Effect Combinations

| Aesthetic | Recommended Effects |
|-----------|---------------------|
| Dark/Dramatic | Dark gradients + large blur orbs + dot pattern |
| Minimalist | Subtle light gradients + clean shadows + no patterns |
| Tech/Modern | Mesh gradients + glass morphism + grid pattern |
| Luxury | Deep gradients + colored shadows + gold accents |
| Playful | Bright orbs + rounded shapes + floating decorations |

### Usage Tips

1. **Always add \`overflow-hidden\`** to sections with orbs/decorations
2. **Use \`pointer-events-none\`** on decorative elements
3. **Layer with z-index**: decorations → content (\`relative z-10\`)
4. **Don't overdo it**: Pick 2-3 effects max per section
5. **Match your aesthetic**: Dark gradients for dark themes, light for light
`;
