/**
 * Spacing rhythm and typography scale guidance for consistent, professional layouts.
 * Clear rules about text sizes, spacing, and visual hierarchy.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const spacingScalePrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Typography & Spacing Scale

Consistent sizing creates professional polish. Use these scales.

### Typography Scale

**Headlines (use distinctive fonts):**
| Element | Mobile | Desktop | Weight |
|---------|--------|---------|--------|
| Hero H1 | text-4xl (36px) | text-6xl or text-7xl (60-72px) | font-bold |
| Section H2 | text-3xl (30px) | text-4xl or text-5xl (36-48px) | font-bold |
| Card H3 | text-xl (20px) | text-2xl (24px) | font-semibold |
| Subheads | text-lg (18px) | text-xl (20px) | font-medium |

**Body text:**
| Element | Size | Color |
|---------|------|-------|
| Hero subhead | text-xl or text-2xl | text-primary-foreground/80 or text-muted-foreground |
| Body copy | text-base (16px) | text-foreground or text-muted-foreground |
| Small/captions | text-sm (14px) | text-muted-foreground |
| Tiny | text-xs (12px) | text-muted-foreground |

**Example hero typography:**
\`\`\`tsx
<h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
  Transform Your <span className="text-secondary">Business</span> Today
</h1>
<p className="text-xl md:text-2xl text-muted-foreground mt-6 max-w-2xl">
  The subheadline that explains the value proposition in one clear sentence.
</p>
\`\`\`

### Spacing Scale

**Section padding:**
\`\`\`tsx
// Standard sections
className="py-16 md:py-24"  // 64px mobile, 96px desktop

// Hero (more breathing room)
className="py-20 md:py-32"  // 80px mobile, 128px desktop

// Compact sections
className="py-12 md:py-16"  // 48px mobile, 64px desktop
\`\`\`

**Container and gutters:**
\`\`\`tsx
// Standard container with side padding
<div className="container mx-auto px-4 md:px-6">

// Max-width for readability
<div className="max-w-4xl mx-auto px-4 md:px-6">

// Full-width with padding
<div className="w-full px-4 md:px-8 lg:px-16">
\`\`\`

**Element spacing:**
| Between | Spacing |
|---------|---------|
| H1 → subhead | mt-4 or mt-6 |
| Subhead → CTA | mt-8 or mt-10 |
| Section title → content | mb-12 or mb-16 |
| Cards in grid | gap-6 or gap-8 |
| Stacked elements | space-y-4 or space-y-6 |
| Icon → text | gap-3 or gap-4 |

### Visual Hierarchy Rules

**Size contrast creates hierarchy:**
\`\`\`tsx
// GOOD: Clear hierarchy
<h2 className="text-4xl font-bold">Section Title</h2>
<p className="text-lg text-muted-foreground mt-4">Supporting text</p>

// BAD: No contrast
<h2 className="text-xl font-medium">Section Title</h2>
<p className="text-lg">Supporting text</p>  // Too similar!
\`\`\`

**The 3:1 rule:** Headlines should be ~3x larger than body text.

### Responsive Patterns

**Text that scales:**
\`\`\`tsx
// Hero headline
className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl"

// Section headline
className="text-3xl md:text-4xl lg:text-5xl"

// Subheadline
className="text-lg md:text-xl lg:text-2xl"
\`\`\`

**Grids that collapse:**
\`\`\`tsx
// 3-column → 1-column
className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8"

// 4-column → 2-column → 1-column
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"

// Asymmetric split
className="grid grid-cols-1 md:grid-cols-5 gap-8"
// Then use md:col-span-3 and md:col-span-2 for uneven splits
\`\`\`

### Content Width Guidelines

| Content Type | Max Width | Class |
|--------------|-----------|-------|
| Hero headline | 4xl (56rem) | max-w-4xl |
| Body paragraphs | 2xl (42rem) | max-w-2xl |
| Section containers | 6xl (72rem) | max-w-6xl |
| Full-width | None | w-full |

**Centering content:**
\`\`\`tsx
// Centered text block
<div className="max-w-3xl mx-auto text-center">
  <h2 className="text-4xl font-bold">Section Title</h2>
  <p className="mt-4 text-lg text-muted-foreground">Description</p>
</div>
\`\`\`

### Quick Reference

**Standard section structure:**
\`\`\`tsx
<section className="py-16 md:py-24 bg-background">
  <div className="container mx-auto px-4 md:px-6">
    {/* Section header */}
    <div className="max-w-3xl mx-auto text-center mb-12 md:mb-16">
      <h2 className="text-3xl md:text-4xl font-bold">Section Title</h2>
      <p className="mt-4 text-lg text-muted-foreground">
        Supporting description text.
      </p>
    </div>

    {/* Content grid */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
      {/* Cards/items */}
    </div>
  </div>
</section>
\`\`\`
`;
