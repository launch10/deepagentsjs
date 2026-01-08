# Plan: Theme Integration (Rails-Only)

## Problem

Community themes have `colors[]` (hex array) but no `theme` field (CSS custom properties). The coding agent needs design tokens it can "just use" — including knowing which color combinations are WCAG-accessible.

## Architecture Context

```
User picks theme → Rails expands colors to CSS vars + pairings → Graph reload → buildContext loads theme → Agent uses design tokens with safe pairings
```

**What already works:**

- `buildContext.ts:39-54` loads `theme` from DB into `state.theme`
- Agent receives `state.theme` with full CSS custom properties
- `useWebsiteBuilderChat` (like `useBrainstormChat`) will reload graph on theme change
- WebContainer with `pnpm dev` hot reloads when files change

**What's missing:**

- Community themes only have `colors[]`, not the expanded `theme` field
- Agent doesn't know which color combinations are WCAG-accessible

---

## Color Role Semantics

| Role | Purpose | Used With | WCAG Requirement |
|------|---------|-----------|------------------|
| `--background` | Page background | `--foreground` (body text) | 4.5:1 for text |
| `--primary` | CTAs, primary buttons, links | `--primary-foreground` | 4.5:1 for button text |
| `--secondary` | Secondary buttons, less prominent actions | `--secondary-foreground` | 4.5:1 |
| `--accent` | Highlights, badges, active states, hover | `--accent-foreground` | 4.5:1 |
| `--muted` | Disabled states, subtle backgrounds | `--muted-foreground` | 3:1 acceptable |
| `--card` | Card/panel backgrounds | `--card-foreground` | 4.5:1 |
| `--destructive` | Delete buttons, error states | `--destructive-foreground` | 4.5:1 |
| `--warning` | Warning badges, caution states | `--warning-foreground` | 4.5:1 |
| `--success` | Success messages, confirmations | `--success-foreground` | 4.5:1 |
| `--popover` | Dropdowns, tooltips, menus | `--popover-foreground` | 4.5:1 |

---

## Solution Overview

1. **Add `pairings` column** to themes table
2. **Rails model callback** expands `colors[]` → `theme` (CSS vars) + `pairings` (accessible combinations)
3. **buildContext** loads both into agent state
4. **Agent** uses pairings to know which colors are safe together

---

## Step 1: Migration

```ruby
# db/migrate/xxx_add_pairings_to_themes.rb
class AddPairingsToThemes < ActiveRecord::Migration[7.0]
  def change
    add_column :themes, :pairings, :jsonb
  end
end
```

---

## Step 2: Rails Model Callback

```ruby
# app/models/theme.rb
class Theme < ApplicationRecord
  before_save :expand_colors, if: -> { colors_changed? && colors.present? }

  private

  def expand_colors
    return if theme_type == "official" # Official themes are manually curated

    result = Themes::ColorExpander.call(colors)
    self.theme = result[:variables]
    self.pairings = result[:pairings]
  end
end
```

---

## Step 3: Themes::ColorExpander Service

**Location:** `rails_app/app/services/themes/color_expander.rb`

**Core responsibility:** Take 6 hex colors → Generate 30+ CSS custom properties with proper contrast + accessible pairings.

```ruby
# app/services/themes/color_expander.rb
module Themes
  class ColorExpander
    CONTRAST_COLORS = { light: "#FAFAFA", dark: "#0A0A0A" }.freeze
    DEFAULT_NEUTRALS = { white: "#FFFFFF", off_white: "#F8F9FA", light_gray: "#E9ECEF" }.freeze
    DEFAULT_STATUS = { destructive: "#dc3545", warning: "#ffc107", success: "#198754" }.freeze

    PAIRABLE_ROLES = %w[background primary secondary accent muted card destructive warning success popover].freeze

    USE_CASES = {
      "background" => ["page background", "main content area"],
      "primary" => ["CTA buttons", "primary links", "important actions"],
      "secondary" => ["secondary buttons", "less prominent actions"],
      "accent" => ["badges", "highlights", "active states", "focus rings"],
      "muted" => ["disabled states", "placeholder text", "subtle backgrounds"],
      "card" => ["card backgrounds", "modal backgrounds", "panels"],
      "destructive" => ["delete buttons", "error messages"],
      "warning" => ["warning badges", "caution states"],
      "success" => ["success messages", "confirmation states"],
      "popover" => ["dropdown menus", "tooltips", "popovers"]
    }.freeze

    def self.call(colors)
      new(colors).call
    end

    def initialize(colors)
      @colors = colors.map { |c| c.start_with?("#") ? c : "##{c}" }
      @color_infos = @colors.map { |hex| color_info(hex) }.compact
    end

    def call
      semantic_map = assign_semantic_roles
      add_foregrounds(semantic_map)

      {
        variables: convert_to_hsl(semantic_map),
        pairings: generate_pairings(semantic_map)
      }
    end

    private

    # === Color Info ===

    def color_info(hex)
      color = Chroma.paint(hex)
      {
        hex: hex,
        luminance: color.luminance,
        saturation: color.hsl.s,
        hue: color.hsl.h,
        color: color
      }
    rescue
      nil
    end

    # === Semantic Role Assignment ===
    # Selection criteria:
    # - Background: highest luminance (> 0.85), lowest saturation (< 0.1)
    # - Primary: best score of deltaE + contrast + saturation + luminance balance
    # - Secondary: different hue from primary (15-45° or 135-180°), good bg contrast
    # - Accent: most distinct from primary AND secondary, high saturation
    # - Muted: lowest saturation, or desaturated version of least saturated
    # - Status: matched by hue (red 345-15°, yellow 15-65°, green 65-170°)

    def assign_semantic_roles
      available = @color_infos.dup
      map = {}

      # Background: lightest, most neutral
      bg = select_background(available)
      map["--background"] = bg[:hex]
      available.delete(bg)

      # Card/Popover: slightly different from background
      card = select_card(available, bg)
      map["--card"] = card[:hex]
      map["--popover"] = card[:hex]

      # Primary: most visually distinct, saturated
      primary = select_primary(available, bg)
      map["--primary"] = primary[:hex]
      available.delete(primary)

      # Secondary: complementary to primary
      secondary = select_secondary(available, primary, bg)
      map["--secondary"] = secondary[:hex]
      available.delete(secondary)

      # Accent: distinct from both primary and secondary
      accent = select_accent(available, primary, secondary, bg)
      map["--accent"] = accent[:hex]
      available.delete(accent)

      # Muted: low saturation neutral
      muted = select_muted(available, bg)
      map["--muted"] = muted[:hex]

      # Status colors by hue range
      map["--destructive"] = find_status_color(345..15) || DEFAULT_STATUS[:destructive]
      map["--warning"] = find_status_color(15..65) || DEFAULT_STATUS[:warning]
      map["--success"] = find_status_color(65..170) || DEFAULT_STATUS[:success]

      # Derived UI colors
      map["--border"] = derive_border(bg)
      map["--input"] = derive_border(bg)
      map["--ring"] = map["--primary"]

      map
    end

    # === Foreground Generation ===
    # For each background, derive a foreground that meets WCAG AA (4.5:1)

    def add_foregrounds(map)
      PAIRABLE_ROLES.each do |role|
        bg_hex = map["--#{role}"]
        next unless bg_hex

        map["--#{role}-foreground"] = contrasting_foreground(bg_hex)
        map["--#{role}-foreground-muted"] = muted_foreground(bg_hex, map["--#{role}-foreground"])
      end

      # Special case: --foreground is the foreground for --background
      map["--foreground"] = map["--background-foreground"]

      map
    end

    def contrasting_foreground(bg_hex)
      bg = Chroma.paint(bg_hex)
      light_contrast = Chroma.contrast(bg_hex, CONTRAST_COLORS[:light])
      dark_contrast = Chroma.contrast(bg_hex, CONTRAST_COLORS[:dark])

      if bg.luminance > 0.5
        dark_contrast >= 4.5 ? CONTRAST_COLORS[:dark] : CONTRAST_COLORS[:light]
      else
        light_contrast >= 4.5 ? CONTRAST_COLORS[:light] : CONTRAST_COLORS[:dark]
      end
    end

    def muted_foreground(bg_hex, fg_hex)
      # Mix foreground with background for a softer contrast (still meets 3:1)
      bg = Chroma.paint(bg_hex)
      fg = Chroma.paint(fg_hex)
      mixed = fg.mix_with(bg, 0.25)

      # Verify contrast meets muted threshold (3:1)
      if Chroma.contrast(bg_hex, mixed.to_hex) >= 3.0
        mixed.to_hex
      else
        fg_hex # Fall back to full contrast
      end
    end

    # === Pairings Generation ===

    def generate_pairings(map)
      PAIRABLE_ROLES.map do |role|
        bg_hex = map["--#{role}"]
        fg_hex = map["--#{role}-foreground"]
        fg_muted_hex = map["--#{role}-foreground-muted"]
        next unless bg_hex && fg_hex

        contrast = Chroma.contrast(bg_hex, fg_hex)

        {
          role: role,
          background: "--#{role}",
          foreground: "--#{role}-foreground",
          foreground_muted: "--#{role}-foreground-muted",
          contrast_ratio: contrast.round(2),
          wcag_aa: contrast >= 4.5,
          wcag_aaa: contrast >= 7.0,
          use_cases: USE_CASES[role] || []
        }
      end.compact
    end

    # === HSL Conversion ===

    def convert_to_hsl(map)
      map.transform_values { |hex| hex_to_hsl_string(hex) }
    end

    def hex_to_hsl_string(hex)
      hsl = Chroma.paint(hex).hsl
      "hsl(#{hsl.h.round}, #{(hsl.s * 100).round}%, #{(hsl.l * 100).round}%)"
    end

    # === Helper Methods ===
    # (select_background, select_primary, select_secondary, etc.)
    # See TypeScript implementation for scoring algorithms
  end
end
```

**Estimated size:** ~200-250 lines of Ruby

---

## Step 4: Update TypeScript Types

```typescript
// shared/types/website/theme.ts

// Add pairing schema
export const pairingSchema = z.object({
  role: z.string(),
  background: z.string(),
  foreground: z.string(),
  foreground_muted: z.string().optional(),
  contrast_ratio: z.number(),
  wcag_aa: z.boolean(),
  wcag_aaa: z.boolean().optional(),
  use_cases: z.array(z.string()),
});

export type PairingType = z.infer<typeof pairingSchema>;

// Update theme schema
export const themeSchema = baseModelSchema.extend({
  name: z.string(),
  colors: z.array(hexadecimalColorSchema),
  theme: cssThemeSchema,
  pairings: z.array(pairingSchema).optional(),
});
```

---

## Step 5: Update buildContext

```typescript
// langgraph_app/app/nodes/codingAgent/buildContext.ts

// Lines 46-54: Add pairings to theme object
if (themeRow) {
  theme = {
    id: themeRow.id,
    name: themeRow.name,
    colors: (themeRow.colors as string[]) || [],
    theme: (themeRow.theme as Website.Theme.CssThemeType) || {},
    pairings: (themeRow.pairings as Website.Theme.PairingType[]) || [],
  };
}
```

---

## What the Agent Sees

```json
{
  "id": 123,
  "name": "Ocean Breeze",
  "colors": ["1E90FF", "FF6B6B", "F0F4F8", "2D3748", "E2E8F0", "48BB78"],
  "theme": {
    "--primary": "hsl(210, 100%, 56%)",
    "--primary-foreground": "hsl(0, 0%, 98%)",
    "--secondary": "hsl(0, 100%, 70%)",
    "--secondary-foreground": "hsl(0, 0%, 4%)",
    "--background": "hsl(210, 33%, 96%)",
    "--foreground": "hsl(0, 0%, 4%)",
    "--accent": "hsl(145, 63%, 49%)",
    "--accent-foreground": "hsl(0, 0%, 4%)"
  },
  "pairings": [
    {
      "role": "primary",
      "background": "--primary",
      "foreground": "--primary-foreground",
      "foreground_muted": "--primary-foreground-muted",
      "contrast_ratio": 8.2,
      "wcag_aa": true,
      "wcag_aaa": true,
      "use_cases": ["CTA buttons", "primary links", "important actions"]
    },
    {
      "role": "background",
      "background": "--background",
      "foreground": "--foreground",
      "contrast_ratio": 12.1,
      "wcag_aa": true,
      "wcag_aaa": true,
      "use_cases": ["page background", "main content area"]
    },
    {
      "role": "destructive",
      "background": "--destructive",
      "foreground": "--destructive-foreground",
      "contrast_ratio": 5.8,
      "wcag_aa": true,
      "wcag_aaa": false,
      "use_cases": ["delete buttons", "error messages"]
    }
  ]
}
```

---

## Data Flow

```
1. User creates community theme via ThemesController#create
   - params: { name: "My Theme", colors: ["FF5733", "33FF57", ...] }

2. Theme model before_save callback
   - Themes::ColorExpander.call(colors)
   - Returns { variables: {...}, pairings: [...] }
   - Saves both to theme.theme and theme.pairings

3. Theme saved to DB with colors[], theme{}, and pairings[]

4. User selects theme for website (existing UI)
   - Website.theme_id updated

5. Frontend reloads graph (useWebsiteBuilderChat)
   - Same pattern as useBrainstormChat

6. buildContext.ts loads theme + pairings from DB
   - state.theme includes pairings array

7. Agent uses design tokens with confidence
   - Knows which combinations are WCAG-accessible
   - Knows use cases for each role
   - No guessing required
```

---

## Files to Modify

| File | Change |
|------|--------|
| `rails_app/db/migrate/xxx_add_pairings_to_themes.rb` | New migration |
| `rails_app/app/models/theme.rb` | Add `before_save :expand_colors` callback |
| `rails_app/app/services/themes/color_expander.rb` | New service (~200-250 lines) |
| `rails_app/Gemfile` | Add `chroma` gem if not present |
| `shared/types/website/theme.ts` | Add `pairingSchema` and update `themeSchema` |
| `langgraph_app/app/nodes/codingAgent/buildContext.ts` | Load `pairings` into state |

---

## What We're NOT Doing

- ❌ No IndexCssService - agent already has design tokens
- ❌ No graph flow changes
- ❌ No new annotations
- ❌ No propagate_to_websites callbacks
- ❌ No moving TypeScript services from TODO folder

---

## Edge Cases

**Existing community themes without `theme` field:**

Migration to backfill all existing community themes:

```ruby
# db/migrate/xxx_backfill_community_theme_css_vars.rb
class BackfillCommunityThemeCssVars < ActiveRecord::Migration[7.0]
  def up
    Theme.community.find_each do |theme|
      next if theme.colors.blank?

      result = Themes::ColorExpander.call(theme.colors)
      theme.update_columns(
        theme: result[:variables],
        pairings: result[:pairings]
      )
    end
  end
end
```

**Official themes:**

- Skip expansion callback - official themes have manually curated `theme` field
- Guard: `return if theme_type == "official"`
- Can optionally add pairings to official themes manually or via rake task

**Invalid colors:**

- `ColorExpander` handles gracefully with fallbacks
- Uses default status colors (Bootstrap red/yellow/green) if hue detection fails
- Always generates valid pairings even with fallback colors

---

## Testing

```ruby
# spec/services/themes/color_expander_spec.rb
RSpec.describe Themes::ColorExpander do
  let(:colors) { %w[#1E90FF #FF6B6B #F0F4F8 #2D3748 #E2E8F0 #48BB78] }
  let(:result) { described_class.call(colors) }

  describe "#call" do
    it "returns variables and pairings" do
      expect(result.keys).to contain_exactly(:variables, :pairings)
    end
  end

  describe "variables" do
    it "generates all required CSS variables" do
      expect(result[:variables].keys).to include(
        "--background", "--foreground",
        "--primary", "--primary-foreground",
        "--secondary", "--secondary-foreground",
        "--accent", "--accent-foreground",
        "--muted", "--muted-foreground",
        "--destructive", "--destructive-foreground",
        "--warning", "--warning-foreground",
        "--success", "--success-foreground",
        "--card", "--card-foreground",
        "--popover", "--popover-foreground",
        "--border", "--input", "--ring"
      )
    end

    it "generates HSL string values" do
      expect(result[:variables]["--primary"]).to match(/hsl\(\d+, \d+%, \d+%\)/)
    end
  end

  describe "pairings" do
    it "generates pairings for all roles" do
      roles = result[:pairings].map { |p| p[:role] }
      expect(roles).to include(
        "background", "primary", "secondary", "accent",
        "muted", "card", "destructive", "warning", "success"
      )
    end

    it "ensures WCAG AA contrast for all pairings" do
      result[:pairings].each do |pairing|
        expect(pairing[:wcag_aa]).to be(true),
          "#{pairing[:role]} failed WCAG AA (contrast: #{pairing[:contrast_ratio]})"
      end
    end

    it "includes use cases for each pairing" do
      result[:pairings].each do |pairing|
        expect(pairing[:use_cases]).to be_an(Array)
        expect(pairing[:use_cases]).not_to be_empty
      end
    end
  end
end

# spec/models/theme_spec.rb
RSpec.describe Theme do
  describe "before_save callback" do
    it "expands colors to theme and pairings for community themes" do
      theme = Theme.new(
        name: "My Theme",
        colors: %w[#1E90FF #FF6B6B #F0F4F8 #2D3748 #E2E8F0 #48BB78],
        author: create(:account)
      )

      expect(theme.theme).to be_nil
      expect(theme.pairings).to be_nil

      theme.save!

      expect(theme.theme).to include("--primary", "--background")
      expect(theme.pairings).to be_an(Array)
      expect(theme.pairings.first).to include("role", "contrast_ratio", "wcag_aa")
    end

    it "skips expansion for official themes" do
      theme = Theme.new(
        name: "Official Theme",
        colors: %w[#FF5733],
        theme_type: "official",
        theme: { "--primary" => "hsl(10, 100%, 60%)" }
      )

      theme.save!
      expect(theme.pairings).to be_nil
    end
  end
end
```

---

## Dependencies

**Ruby gem:** `chroma` - Color manipulation library

```ruby
# Gemfile
gem "chroma"
```

Key methods we need:
- `Chroma.paint(hex)` - Parse hex color
- `color.luminance` - Get relative luminance
- `color.hsl` - Get HSL components
- `Chroma.contrast(color1, color2)` - Calculate WCAG contrast ratio
- `color.mix_with(other, amount)` - Blend colors

---

## Summary

This is primarily a **Rails change** with minor TypeScript type updates. The coding agent already receives theme data via `buildContext`. We're enhancing it with:

1. **CSS custom properties** (`theme` field) - generated from hex colors
2. **Accessible pairings** (`pairings` field) - pre-computed WCAG-compliant combinations with use cases

Total changes:
- 1 migration (~5 lines)
- 1 model callback (~10 lines)
- 1 new service (~200-250 lines)
- 1 backfill migration (~15 lines)
- TypeScript types (~20 lines)
- buildContext update (~2 lines)
- Tests (~80 lines)

---

## Revision History

### v1: Initial Plan (Rejected)

**Approach:** Move `IndexCssService.ts` from TODO folder to active, call it from `buildContext.ts` to apply theme CSS vars to `index.css` on every graph invocation.

**Reviewers:** DHH Rails Reviewer, Kieran Rails Reviewer, Code Simplicity Reviewer

**Feedback:**

| Reviewer | Verdict | Key Criticism |
|----------|---------|---------------|
| DHH | Wrong Layer | "Theme application is a Rails concern, not an AI agent concern. The agent's job is to respond to user requests—theme application is CRUD, not AI." |
| Kieran | Needs Revision | API signatures were wrong, template vs website file confusion, "apply every invocation" is wasteful (20 messages = 20 unnecessary writes) |
| Code Simplicity | Major Simplification Needed | IndexCssService is 75 lines for 15 lines of logic. Ruby service marked "optional" is YAGNI. Agent might already handle this naturally. |

**Consensus:**
- All agreed `IndexCssService` was over-complicated
- All agreed Ruby `ThemeExpanderService` shouldn't be "optional"
- 2/3 agreed logic belongs in Rails, not Langgraph
- 2/3 agreed "apply every invocation" was wasteful

### v2: Rails-Only Approach (Accepted with Enhancement)

**Decision:** Move all theme expansion logic to Rails. Use `before_save` callback to expand `colors[]` → `theme` (CSS vars). Agent already loads theme via `buildContext`—no Langgraph changes needed.

**User feedback:** Agreed with Rails-only approach. Noted:
- Community themes DO exist (created in `themes_controller`)
- Don't need `propagate_to_websites`—that's overengineered
- Frontend (`useWebsiteBuilderChat`) will reload graph on theme change
- WebContainer with `pnpm dev` will hot reload when files change

### v3: Added Pairings for WCAG Accessibility (Current)

**Question raised:** "How do we ensure WCAG? How do we know which colors will be used together? Should we recommend to agent which colors work together?"

**Discussion:**
- Agent needs to know which color combinations are safe (WCAG AA = 4.5:1 contrast)
- The naming convention (`--X` + `--X-foreground`) implies pairings, but we should make it explicit
- Options considered:
  1. Document pattern in system prompt only
  2. Compute pairings at API time (runtime)
  3. Store pairings in DB alongside theme (compute once at save time)

**Decision:** Add `pairings` jsonb column to themes table. Compute pairings at save time alongside CSS vars. Each pairing includes:
- Role name and CSS variable names
- Pre-computed contrast ratio
- WCAG AA/AAA compliance flags
- Use cases (e.g., "CTA buttons", "error messages")

**Rationale:**
- Pairings are deterministic from theme variables
- Compute once at save, not on every read
- Agent gets explicit, validated accessibility info
- No guessing which colors go together
