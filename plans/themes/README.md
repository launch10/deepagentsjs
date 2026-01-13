# Theme System

## Theory of the Case

**Palette colors are ACCENT colors, not background colors.**

A user provides 6 hex colors. We generate semantic CSS variables following shadcn/ui conventions. The AI agent uses these variables via Tailwind classes (`bg-primary`, `text-primary-foreground`, etc.) to build landing pages.

### The Pipeline

```
User picks 6 hex colors
       ↓
Theme#before_save: SemanticVariables.create_semantic_variables(colors)
       ↓
Generates shadcn/ui CSS variables (--background, --primary, --card, etc.)
       ↓
User assigns theme to website
       ↓
Website#after_save: inject_theme_css! → Updates src/index.css :root block
       ↓
Langgraph loads theme → Passes to coding agent prompts
       ↓
AI uses semantic classes: bg-primary, text-primary-foreground, bg-card, etc.
```

### The Core Insight

The algorithm's job is to assign **semantic roles** to colors:

| Role       | What It's For              | Tailwind Class  |
| ---------- | -------------------------- | --------------- |
| background | Page canvas                | `bg-background` |
| primary    | Hero, CTA, footer sections | `bg-primary`    |
| secondary  | Buttons, badges            | `bg-secondary`  |
| accent     | Small highlights           | `bg-accent`     |
| muted      | Subtle section variation   | `bg-muted`      |
| card       | Content containers         | `bg-card`       |

**Critical rule**: `background` is DERIVED as a near-neutral (tinted off-white or near-black), NOT selected from the palette. Palette colors are too vibrant for backgrounds.

## Key Files

### Rails (Theme Generation)

| File                                                               | Purpose                             |
| ------------------------------------------------------------------ | ----------------------------------- |
| `app/models/theme.rb`                                              | Core model, orchestrates generation |
| `app/models/concerns/theme_concerns/semantic_variables.rb`         | The algorithm - hex → CSS vars      |
| `app/models/concerns/theme_concerns/typography_recommendations.rb` | Text color guidance                 |
| `app/models/concerns/website_concerns/theme_css_injection.rb`      | Injects CSS into websites           |

### Langgraph (Theme Usage)

| File                                              | Purpose                            |
| ------------------------------------------------- | ---------------------------------- |
| `app/nodes/coding/agent.ts`                       | Loads theme, passes to prompts     |
| `app/prompts/coding/shared/design/themeColors.ts` | Teaches AI semantic color roles    |
| `app/prompts/coding/shared/design/typography.ts`  | Formats typography recommendations |

### Frontend

| File                                                                                                  | Purpose          |
| ----------------------------------------------------------------------------------------------------- | ---------------- |
| `app/javascript/frontend/components/brainstorm/conversation-page/brand-panel/ColorPaletteSection.tsx` | Theme picker UI  |
| `app/javascript/frontend/api/themes.hooks.ts`                                                         | Theme fetching   |
| `app/javascript/frontend/api/websites.hooks.ts`                                                       | Theme assignment |

## Semantic Variable Generation

The `SemanticVariables` concern (412 lines) is the heart of the system.

### Input → Output

**Input**: `["264653", "2A9D8F", "E9C46A", "F4A261", "E76F51"]`

**Output** (CSS variables in HSL):

```css
--background: 43 20% 98%; /* Derived neutral (NOT from palette) */
--foreground: 0 0% 10%; /* Auto-contrasting text */
--primary: 197 37% 24%; /* Darkest saturated palette color */
--primary-foreground: 0 0% 98%;
--secondary: 162 55% 44%; /* Most vibrant palette color */
--card: 0 0% 100%; /* Pure white (light theme) */
--muted: 43 15% 94%; /* Subtle variation of background */
--destructive: 0 84% 60%; /* Derived red */
--warning: 39 96% 57%; /* Derived orange */
--success: 163 72% 40%; /* Derived green */
```

### Key Design Decisions

1. **Background derivation**: Takes dominant color's hue, applies to near-neutral
   - Light theme: `hsl(hue, 20%, 98%)` - warm off-white
   - Dark theme: `hsl(hue, 15%, 8%)` - tinted near-black

2. **Card differs from background**: Creates depth
   - Light theme: pure white (`FFFFFF`)
   - Dark theme: slightly elevated (`hsl(hue, 20%, 12%)`)

3. **Status colors derived**: If palette lacks red/orange/green, we derive them using the primary color's saturation characteristics

4. **WCAG compliance**: All foreground colors are computed to meet AA contrast (4.5:1 minimum)

## Prompt Integration

The coding agent receives theme data and two key prompts:

### themeColorsPrompt (always included)

Teaches the AI:

- Semantic color roles (background, primary, secondary, etc.)
- Safe section backgrounds: `bg-background`, `bg-muted`, `bg-primary` ONLY
- Card elevation patterns
- Forbidden patterns (never `bg-secondary` for full sections)

### typographyPrompt (when theme has recommendations)

Provides per-background guidance:

```
On #264653 background:
  Headlines: #E9C46A (8.2:1 AAA) [palette color]
  Body: #FAFAFA (12.5:1 AAA) [standard]
```

## Database Schema

```ruby
# themes table
id                         :bigint
name                       :string
colors                     :jsonb    # ["264653", "2A9D8F", ...]
theme                      :jsonb    # {"--background": "43 20% 98%", ...}
pairings                   :jsonb    # Contrast ratios between all colors
typography_recommendations :jsonb    # Per-background text guidance
theme_type                 :string   # "official" or "community"
author_id                  :bigint   # For community themes
```

## Plans

| Plan                                            | Description                        |
| ----------------------------------------------- | ---------------------------------- |
| [Deviations & Recommendations](./deviations.md) | Current issues and recommendations |

## Related

- [Coding Agent](../coding-agent/) - Uses theme tokens for generation
