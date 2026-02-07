# Themes

The theme system controls a website's color palette and typography. Each theme stores 5 hex colors, from which semantic CSS variables (primary, secondary, accent, background, etc.) are automatically generated with WCAG-compliant contrast pairings. Themes are independent of templates — any theme works with any template.

## How It Works

```
5 Hex Colors → SemanticVariables concern → CSS Variables (HSL)
                    │                            │
                    ├─ WCAG pairings computed     │
                    ├─ Typography recommendations │
                    └─ Dark/light mode detected   │
                                                  ▼
                                    inject into src/index.css
                                    (`:root { ... }` block swap)
```

1. **Theme created** with `colors` array (e.g., `["606C38", "283618", "FEFAE0", "DDA15E", "BC6C25"]`)
2. **`before_save` callback** runs `save_semantic_variables`:
   - Analyzes HSL values, luminance, saturation for each color
   - Assigns semantic roles: `--primary` (most saturated), `--secondary`, `--accent`, `--background` (derived neutral)
   - Computes foreground colors for each role
   - Generates WCAG contrast pairings (AA, AA-large, AAA)
   - Creates typography recommendations (headlines, body, accents)
3. **When applied to a website**, `inject_theme_css!` replaces the `:root { ... }` block in `src/index.css`
4. **No AI regeneration needed** — theme changes are a silent CSS swap

## Theme Types

| Type | Author | Visibility | Count |
|------|--------|-----------|-------|
| Official | None (platform-owned) | All users | ~20+ |
| Community | Account (user-created) | Author's account only | Per-account |

## Semantic Variables Generated

| Variable | Assignment Logic |
|----------|-----------------|
| `--primary` | Most saturated color (for hero/CTAs) |
| `--secondary` | Second most vibrant color |
| `--accent` | Third most vibrant, different hue |
| `--background` | Derived neutral (palettes are accents, not backgrounds) |
| `--card` | Pure white (light) or elevated gray (dark) |
| `--muted` | Same hue as primary, desaturated |
| `--destructive` | Red (status) |
| `--{role}-foreground` | Contrast-safe text color for each role |

All variables stored in HSL format: `"88 38% 15%"` → used as `hsl(88 38% 15%)` in CSS.

## Label System

57 predefined labels for categorization: professional, modern, bold, warm, cool, earthy, gradient, monochromatic, high-contrast, etc. Applied via `ThemeLabel` + `ThemeToThemeLabel` join table.

## Key Files Index

| File | Purpose |
|------|---------|
| `rails_app/app/models/theme.rb` | Theme model (colors, semantic vars, pairings) |
| `rails_app/app/models/concerns/theme_concerns/semantic_variables.rb` | Color → CSS variable generation (420 lines) |
| `rails_app/app/models/concerns/theme_concerns/typography_recommendations.rb` | WCAG-based typography recs (247 lines) |
| `rails_app/app/models/concerns/website_concerns/theme_css_injection.rb` | Injects CSS vars into website's index.css |
| `rails_app/app/controllers/api/v1/themes_controller.rb` | CRUD API (scoped: official + user's community) |
| `rails_app/app/policies/theme_policy.rb` | Pundit policy (author-only for community) |
| `rails_app/lib/tasks/themes.rake` | `themes:regenerate`, `themes:export` rake tasks |
| `langgraph_app/app/nodes/website/themeHandler.ts` | Graph node for silent theme swap |
| `langgraph_app/app/prompts/coding/shared/design/themeColors.ts` | AI prompt guidance for theme colors |

## Gotchas

- **Palettes are accent colors, not backgrounds.** The `--background` variable is always a derived neutral (near-white or near-black), not a palette color.
- **Dark mode auto-detected**: If average palette luminance < 25%, the system generates dark-mode variables.
- **Typography recommendations are per-background**: For each color used as a background, the system suggests accessible headlines, body text, and accent colors at different WCAG levels.
- **Theme CSS injection is surgical**: Only the `:root { ... }` block is replaced. No other CSS is touched.
