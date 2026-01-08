# Plan: Theme Integration (Rails-Only)

## Problem

Community themes have `colors[]` (hex array) but no `theme` field (CSS custom properties). The coding agent needs design tokens it can "just use."

## Architecture Context

```
User picks theme → Rails expands colors to CSS vars → Graph reload → buildContext loads theme → Agent uses design tokens
```

**What already works:**

- `buildContext.ts:67-79` loads `theme` from DB into `state.theme`
- Agent receives `state.theme` with full CSS custom properties
- `useWebsiteBuilderChat` (like `useBrainstormChat`) will reload graph on theme change
- WebContainer with `pnpm dev` hot reloads when files change

**What's missing:**

- Community themes only have `colors[]`, not the expanded `theme` field

## Solution: Rails Model Callback

When a community theme is created/updated, expand `colors[]` → `theme` (CSS custom properties).

```ruby
# app/models/theme.rb
class Theme < ApplicationRecord
  before_save :expand_colors_to_theme, if: -> { colors_changed? && colors.present? }

  private

  def expand_colors_to_theme
    return if theme_type == "official" # Official themes already have theme field set manually

    self.theme = Themes::ColorExpander.call(colors)
  end
end
```

### Themes::ColorExpander Service

Port the color expansion logic from TypeScript to Ruby. Uses the `chroma` gem for color manipulation.

**Location:** `rails_app/app/services/themes/color_expander.rb`

**Core responsibility:** Take 6 hex colors → Generate 30+ CSS custom properties with proper contrast.

- Ensure WCAG AA contrast for foregrounds
- Use default status colors (Bootstrap red/yellow/green) if hue detection fails

```ruby
# app/services/themes/color_expander.rb
module Themes
  class ColorExpander
    CONTRAST_COLORS = { light: "#FAFAFA", dark: "#0A0A0A" }.freeze
    DEFAULT_NEUTRALS = { white: "#FFFFFF", off_white: "#F8F9FA", light_gray: "#E9ECEF" }.freeze
    DEFAULT_STATUS = { destructive: "#dc3545", warning: "#ffc107", success: "#198754" }.freeze

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
      convert_to_hsl(semantic_map)
    end

    private

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

    def assign_semantic_roles
      available = @color_infos.dup
      map = {}

      # Background: lightest, lowest saturation
      bg = select_background(available)
      map["--background"] = bg[:hex]
      available.delete(bg)

      # Primary, Secondary, Accent: saturated colors with good contrast
      map["--primary"] = select_primary(available, bg)[:hex]
      # ... etc

      # Status colors by hue range
      map["--destructive"] = find_status_color(345..15) || DEFAULT_STATUS[:destructive]
      map["--warning"] = find_status_color(15..65) || DEFAULT_STATUS[:warning]
      map["--success"] = find_status_color(65..170) || DEFAULT_STATUS[:success]

      map
    end

    def add_foregrounds(map)
      # For each background color, derive contrasting foreground
      %w[background primary secondary accent muted destructive warning success card popover].each do |role|
        bg_hex = map["--#{role}"]
        next unless bg_hex

        map["--#{role}-foreground"] = contrasting_foreground(bg_hex)
        map["--#{role}-foreground-muted"] = muted_foreground(bg_hex, map["--#{role}-foreground"])
      end
      map
    end

    def convert_to_hsl(map)
      map.transform_values { |hex| hex_to_hsl_string(hex) }
    end

    def hex_to_hsl_string(hex)
      hsl = Chroma.paint(hex).hsl
      "#{hsl.h.round} #{(hsl.s * 100).round}% #{(hsl.l * 100).round}%"
    end

    def contrasting_foreground(bg_hex)
      bg = Chroma.paint(bg_hex)
      light_contrast = Chroma.contrast(bg_hex, CONTRAST_COLORS[:light])
      dark_contrast = Chroma.contrast(bg_hex, CONTRAST_COLORS[:dark])

      # Pick whichever meets WCAG AA (4.5:1)
      if bg.luminance > 0.5
        dark_contrast >= 4.5 ? CONTRAST_COLORS[:dark] : CONTRAST_COLORS[:light]
      else
        light_contrast >= 4.5 ? CONTRAST_COLORS[:light] : CONTRAST_COLORS[:dark]
      end
    end

    # ... additional helper methods
  end
end
```

**Estimated size:** ~150-200 lines of Ruby (vs ~860 lines of TypeScript)

The Ruby version is simpler because:

1. No TypeScript type gymnastics
2. `chroma` gem has cleaner API than chroma-js
3. We can skip excessive error handling/warnings for v1

---

## Data Flow

```
1. User creates community theme via ThemesController#create
   - params: { name: "My Theme", colors: ["#FF5733", "#33FF57", ...] }

2. Theme model before_save callback
   - Themes::ColorExpander.call(colors) → theme field populated

3. Theme saved to DB with both colors[] and theme{}

4. User selects theme for website (existing UI)
   - Website.theme_id updated

5. Frontend reloads graph (useWebsiteBuilderChat)
   - Same pattern as useBrainstormChat

6. buildContext.ts loads theme from DB
   - state.theme = { id, name, colors, theme: { "--primary": "210 100% 50%", ... } }

7. Agent uses design tokens
   - Already in state.theme, ready to use
   - When agent generates/modifies CSS, it references state.theme values

8. WebContainer hot reloads
   - pnpm dev watches for file changes
   - Preview updates automatically
```

---

## Files to Modify

| File                                              | Change                                             |
| ------------------------------------------------- | -------------------------------------------------- |
| `rails_app/app/models/theme.rb`                   | Add `before_save :expand_colors_to_theme` callback |
| `rails_app/app/services/themes/color_expander.rb` | New service (~150-200 lines)                       |
| `rails_app/Gemfile`                               | Add `chroma` gem if not present                    |

---

## What We're NOT Doing

- ❌ No Langgraph changes - buildContext already loads theme
- ❌ No IndexCssService - agent already has design tokens
- ❌ No graph flow changes
- ❌ No new annotations
- ❌ No propagate_to_websites callbacks
- ❌ No moving TypeScript services from TODO folder

---

## Edge Cases

**Existing community themes without `theme` field:**

- Option A: Migration to backfill all existing community themes
- Option B: Add `after_find` callback that expands on first access (lazy migration)

Recommend Option A for clean data.

```ruby
# db/migrate/xxx_backfill_community_theme_css_vars.rb
class BackfillCommunityThemeCssVars < ActiveRecord::Migration[7.0]
  def up
    Theme.community.where(theme: nil).find_each do |theme|
      theme.update!(theme: Themes::ColorExpander.call(theme.colors))
    end
  end
end
```

**Official themes:**

- Skip expansion callback - official themes have manually curated `theme` field
- Guard: `return if theme_type == "official"`

**Invalid colors:**

- `ColorExpander` handles gracefully with fallbacks
- Uses default status colors (Bootstrap red/yellow/green) if hue detection fails

---

## Testing

```ruby
# spec/services/themes/color_expander_spec.rb
RSpec.describe Themes::ColorExpander do
  it "generates all required CSS variables" do
    colors = %w[#FF5733 #33FF57 #3357FF #F0F0F0 #333333 #FFCC00]
    result = described_class.call(colors)

    expect(result.keys).to include(
      "--background", "--background-foreground",
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
    colors = %w[#FF5733 #33FF57 #3357FF #F0F0F0 #333333 #FFCC00]
    result = described_class.call(colors)

    # HSL format: "210 100% 50%"
    expect(result["--primary"]).to match(/\d+ \d+% \d+%/)
  end

  it "ensures WCAG AA contrast for foregrounds" do
    colors = %w[#FF5733 #33FF57 #3357FF #F0F0F0 #333333 #FFCC00]
    result = described_class.call(colors)

    # Verify contrast ratios meet 4.5:1 minimum
    # (implementation detail in test)
  end
end

# spec/models/theme_spec.rb
RSpec.describe Theme do
  describe "before_save callback" do
    it "expands colors to theme for community themes" do
      theme = Theme.new(
        name: "My Theme",
        colors: %w[#FF5733 #33FF57 #3357FF #F0F0F0 #333333 #FFCC00],
        author: create(:account)
      )

      expect(theme.theme).to be_nil
      theme.save!
      expect(theme.theme).to include("--primary", "--background")
    end

    it "skips expansion for official themes" do
      theme = Theme.new(
        name: "Official Theme",
        colors: %w[#FF5733],
        theme_type: "official",
        theme: { "--primary" => "manually set" }
      )

      theme.save!
      expect(theme.theme["--primary"]).to eq("manually set")
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

If `chroma` is insufficient, alternatives:

- `color` gem
- `colorscore` gem
- Roll our own with basic HSL math (simpler but more code)

---

## Summary

This is a **Rails-only change**. The coding agent already receives theme data via `buildContext`. We just need to ensure community themes have the `theme` field populated when they're created.

Total changes:

- 1 model callback (~5 lines)
- 1 new service (~150-200 lines)
- 1 migration for backfill (~10 lines)
- Tests (~50 lines)
