# Landing Page Generation: Decision History

> Decisions about how the AI coding agent generates landing pages, including prompts, theming, and constraints. Most recent first.

---

## Current State

Theme system provides four layers of color guidance to the agent:

1. **Semantic CSS variables** - For surfaces and UI elements (shadcn convention)
2. **Raw palette colors** - For creative typography and visual interest
3. **Pairings data** - WCAG-compliant combinations for accessibility
4. **Typography recommendations** - Pre-computed guidance for headlines, subheadlines, and body text

The agent uses semantic variables for structure (backgrounds, buttons) but can use palette colors directly for headlines, subheadlines, and accents that make landing pages visually striking. Typography recommendations provide explicit guidance on which colors work best for each text role.

---

## Decision Log

### 2025-01-09: Typography Recommendations Model Concern

**Context:** While pairings data shows which colors work together, the agent still needs to reason about which colors to use for headlines vs body text. We want to pre-compute this guidance so the agent gets clear, actionable recommendations.

**Decision:** Add `TypographyRecommendations` concern that categorizes color options by use case:

- **Headlines** - Bold palette colors (AAA preferred) for attention-grabbing text, plus standard colors (white/black) as clear alternatives
- **Subheadlines** - Palette colors with good contrast, can use AA-large (3:1) for visual variety
- **Body text** - High contrast colors (AAA) prioritizing standard colors for readability
- **Accents** - All accessible palette colors for highlights and decorative elements

**Format for prompts:**

```
Typography Guide:
Palette: #264653, #2A9D8F, #E9C46A, #F4A261, #E76F51

On #E9C46A background:
  Headlines (bold, attention-grabbing):
    - #264653 (6.03:1 AA) [palette color]
    - #0A0A0A (11.85:1 AAA) [standard]
  Subheadlines (visual variety):
    - #264653 (6.03:1 AA)
  Body text (readable, clear):
    - #0A0A0A (11.85:1 AAA)

On #264653 background:
  Headlines (bold, attention-grabbing):
    - #E9C46A (6.03:1 AA) [palette color]
    - #FAFAFA (9.66:1 AAA) [standard]
  ...
```

**Why:**

- Pre-computed recommendations reduce agent reasoning overhead
- Clear distinction between "bold" (palette) and "clear" (standard) colors
- Agent can quickly pick appropriate colors for each text role
- Stored in `typography_recommendations` JSONB column for fast access

**Implementation:**

- `ThemeConcerns::TypographyRecommendations` concern computes recommendations
- `theme.typography_guide_for_prompt` formats for AI prompts
- Stored alongside `theme`, `pairings` in Theme model
- Automatically computed when colors change

**Status:** Current

---

### 2025-01-09: Three-Layer Color System for Landing Pages

**Context:** Landing pages need more than just "background + foreground" - they need visual hierarchy with bold headlines, contrasting subheadlines, and creative use of color. The Playground shows surfaces but doesn't guide typography choices.

**Decision:** Provide the agent with three layers of color information:

**Layer 1: Semantic Variables (for structure)**

```
CSS Variables (Tailwind classes):

Surfaces:
- bg-background + text-foreground: Main sections
- bg-muted + text-muted-foreground: Alternate sections, subdued text
- bg-card + text-card-foreground: Cards, panels

Actions:
- bg-primary + text-primary-foreground: Primary CTA buttons
- bg-secondary + text-secondary-foreground: Secondary buttons
- bg-accent + text-accent-foreground: Badges, highlights
```

**Layer 2: Palette Colors (for typography pop)**

```
Palette: #264653, #2A9D8F, #E9C46A, #F4A261, #E76F51

Use these directly for:
- Bold headlines that grab attention
- Contrasting subheadlines
- Accent text and highlights
- Icon colors
```

**Layer 3: Pairings (for safe combinations)**

```
On #E9C46A background, these colors have good contrast:
- #264653 (12.5:1 AAA) - Great for headlines
- #0A0A0A (15.2:1 AAA) - Body text
- #2A9D8F (3.2:1 AA-large) - Large subheadlines only

On #264653 background:
- #FAFAFA (12.5:1 AAA) - Primary text
- #E9C46A (8.1:1 AAA) - Accent headlines
...
```

**Why:**

- Semantic variables handle the basics (agent can't go wrong)
- Palette colors enable creativity (bold headlines, visual interest)
- Pairings ensure accessibility (agent knows what works together)
- This mirrors how designers think: structure first, then creative flourishes

**Example agent reasoning:**

> "The hero has bg-background (#E9C46A). For maximum impact, I'll use #264653 for the headline (12.5:1 contrast, AAA). The subheadline can be #2A9D8F for visual variety - it's AA-large compliant at this size. CTA uses bg-primary with text-primary-foreground."

**Status:** Current

---

### 2025-01-09: Use shadcn/ui CSS Variable Naming Convention

**Context:** Our original naming (`--background-foreground`, `--background-foreground-muted`) was confusing and non-standard.

**Decision:** Adopt shadcn/ui naming convention:

- `--foreground` (not `--background-foreground`)
- `--muted-foreground` as global subdued text color
- `--{role}-foreground` for each surface role

**Why:**

- Industry standard - agent likely trained on shadcn patterns
- Clearer semantics: `--muted-foreground` is "subdued text" not "foreground for muted bg"
- Better Tailwind integration: `text-foreground`, `text-muted-foreground`

**Implementation:**

- `SemanticVariables.create_semantic_variables()` generates the CSS vars
- `SemanticVariables.compute_pairings()` provides WCAG-compliant combinations
- Theme model stores both in `theme` and `pairings` JSONB columns

**Status:** Current

---
