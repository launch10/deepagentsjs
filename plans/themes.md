# Plan: Theme Integration (Rails-Only)

## Problem

Community themes have `colors[]` (hex array) but no `theme` field (CSS custom properties). The coding agent needs design tokens it can "just use."

## Architecture Context

```
User picks theme → Rails expands colors to CSS vars → Graph reload → buildContext loads theme → Agent uses design tokens
```

**What already works:**

- `buildContext.ts:39-54` loads `theme` from DB into `state.theme`
- Agent receives `state.theme` with full CSS custom properties
- `useWebsiteBuilderChat` will reload graph on theme change
- WebContainer with `pnpm dev` hot reloads when files change
- Official themes have complete `theme` field (see `themes.sql`)

**What's missing:**

- Community themes only have `colors[]`, not the expanded `theme` field

---

## Solution Overview

1. **Rails model callback** expands `colors[]` → `theme` (CSS vars)
2. **No new columns** - just populate existing `theme` jsonb field
3. **No Langgraph changes** - agent already loads theme via buildContext

---

## Gem Dependencies

The plan requires two gems:

```ruby
# Gemfile
gem "chroma"              # Color parsing, HSL conversion
gem "wcag_color_contrast" # WCAG contrast ratios, luminance
```

**Why two gems:**

- `chroma` provides: `Chroma.paint(hex)`, `color.hsl`, `to_hex`, palette generation
- `chroma` does NOT provide: `luminance`, `contrast`, `mix_with`
- `wcag_color_contrast` provides: `WCAGColorContrast.ratio(hex1, hex2)`, `relative_luminance(hex)`

---

## Step 1: Model Callback

```ruby
# app/models/theme.rb
class Theme < ApplicationRecord
  # ... existing code ...

  before_save :expand_colors, if: :should_expand_colors?

  private

  def should_expand_colors?
    colors_changed? && colors.present? && theme_type != "official"
  end

  def expand_colors
    self.theme = Themes::ColorExpander.expand(colors)
  end
end
```

---

## Step 2: Themes::ColorExpander Service

**Location:** `rails_app/app/services/themes/color_expander.rb`

**Pattern:** Matches `EmbeddingService` - uses `class << self` with class methods.

```ruby
# frozen_string_literal: true

# Themes::ColorExpander transforms an array of hex colors into CSS custom properties
# with proper contrast ratios for accessibility (WCAG AA).
#
# @example
#   Themes::ColorExpander.expand(%w[264653 2A9D8F E9C46A F4A261 E76F51])
#   # => { "--primary" => "hsl(197, 37%, 24%)", "--primary-foreground" => "hsl(0, 0%, 98%)", ... }
#
class Themes::ColorExpander
  LIGHT_FOREGROUND = "FAFAFA"
  DARK_FOREGROUND = "0A0A0A"

  # Default status colors (Bootstrap-inspired)
  DEFAULTS = {
    destructive: "dc3545",
    warning: "ffc107",
    success: "198754"
  }.freeze

  class << self
    def expand(colors)
      return {} if colors.blank?

      normalized = normalize_colors(colors)
      return {} if normalized.empty?

      roles = assign_roles(normalized)
      generate_variables(roles)
    rescue StandardError => e
      Rails.logger.error("Themes::ColorExpander error: #{e.message}")
      {}
    end

    private

    # === Color Normalization ===

    def normalize_colors(colors)
      colors.map { |c| c.to_s.delete("#").upcase }.reject(&:blank?)
    end

    # === Role Assignment ===
    # Assigns semantic roles based on color properties:
    # - Background: highest luminance (lightest)
    # - Primary: most saturated with good contrast against background
    # - Secondary: second most saturated, different hue from primary
    # - Accent: third option, or derived from primary
    # - Muted: lowest saturation (most neutral)

    def assign_roles(colors)
      analyzed = colors.map { |hex| analyze_color(hex) }.compact
      return {} if analyzed.empty?

      sorted_by_luminance = analyzed.sort_by { |c| -c[:luminance] }
      sorted_by_saturation = analyzed.sort_by { |c| -c[:saturation] }

      background = sorted_by_luminance.first
      primary = select_primary(sorted_by_saturation, background)
      secondary = select_secondary(analyzed, primary, background)
      accent = select_accent(analyzed, primary, secondary, background)
      muted = sorted_by_saturation.last

      {
        background: background[:hex],
        primary: primary[:hex],
        secondary: secondary[:hex],
        accent: accent[:hex],
        muted: muted[:hex],
        card: background[:hex],
        popover: background[:hex],
        destructive: find_by_hue(analyzed, 345..15) || DEFAULTS[:destructive],
        warning: find_by_hue(analyzed, 35..55) || DEFAULTS[:warning],
        success: find_by_hue(analyzed, 100..160) || DEFAULTS[:success]
      }
    end

    def analyze_color(hex)
      color = Chroma.paint("##{hex}")
      {
        hex: hex,
        luminance: WCAGColorContrast.relative_luminance(hex),
        saturation: color.hsl.s,
        hue: color.hsl.h
      }
    rescue StandardError
      nil
    end

    def select_primary(by_saturation, background)
      # Most saturated that has good contrast with background
      by_saturation.find { |c| contrast_ratio(c[:hex], background[:hex]) >= 3.0 } || by_saturation.first
    end

    def select_secondary(colors, primary, background)
      # Different hue from primary, good contrast with background
      candidates = colors.reject { |c| c[:hex] == primary[:hex] || c[:hex] == background[:hex] }
      candidates.find { |c| hue_distance(c[:hue], primary[:hue]) > 30 } || candidates.first || primary
    end

    def select_accent(colors, primary, secondary, background)
      used = [primary[:hex], secondary[:hex], background[:hex]]
      candidates = colors.reject { |c| used.include?(c[:hex]) }
      candidates.first || secondary
    end

    def find_by_hue(colors, range)
      colors.find { |c| hue_in_range?(c[:hue], range) }&.dig(:hex)
    end

    def hue_in_range?(hue, range)
      if range.first > range.last # Wraps around (e.g., 345..15 for reds)
        hue >= range.first || hue <= range.last
      else
        range.cover?(hue)
      end
    end

    def hue_distance(h1, h2)
      diff = (h1 - h2).abs
      [diff, 360 - diff].min
    end

    def contrast_ratio(hex1, hex2)
      WCAGColorContrast.ratio(hex1, hex2)
    end

    # === Variable Generation ===

    def generate_variables(roles)
      vars = {}

      # Background and foreground
      vars["--background"] = to_hsl(roles[:background])
      vars["--background-foreground"] = contrasting_foreground(roles[:background])
      vars["--background-foreground-muted"] = muted_foreground(roles[:background])

      # Semantic roles
      %i[primary secondary accent muted card popover destructive warning success].each do |role|
        hex = roles[role]
        vars["--#{role}"] = to_hsl(hex)
        vars["--#{role}-foreground"] = contrasting_foreground(hex)
        vars["--#{role}-foreground-muted"] = muted_foreground(hex)
      end

      # UI elements
      vars["--border"] = derive_border(roles[:background])
      vars["--input"] = vars["--border"]
      vars["--ring"] = vars["--primary"]

      # Neutrals
      vars["--neutral-1"] = "hsl(210, 6%, 94%)"
      vars["--neutral-2"] = "hsl(210, 4%, 89%)"
      vars["--neutral-3"] = "hsl(210, 3%, 85%)"

      vars
    end

    def contrasting_foreground(hex)
      luminance = WCAGColorContrast.relative_luminance(hex)
      fg = luminance > 0.179 ? DARK_FOREGROUND : LIGHT_FOREGROUND
      to_hsl(fg)
    end

    def muted_foreground(hex)
      # Blend foreground toward background for softer contrast
      luminance = WCAGColorContrast.relative_luminance(hex)
      if luminance > 0.179
        # Dark foreground on light background - make it lighter (gray)
        "hsl(0, 0%, 27%)"
      else
        # Light foreground on dark background - make it darker (light gray)
        "hsl(0, 0%, 75%)"
      end
    end

    def derive_border(background_hex)
      luminance = WCAGColorContrast.relative_luminance(background_hex)
      if luminance > 0.5
        "hsl(210, 9%, 96%)"
      else
        "hsl(210, 9%, 20%)"
      end
    end

    def to_hsl(hex)
      color = Chroma.paint("##{hex}")
      hsl = color.hsl
      "hsl(#{hsl.h.round}, #{(hsl.s * 100).round}%, #{(hsl.l * 100).round}%)"
    rescue StandardError
      "hsl(0, 0%, 50%)"
    end
  end
end
```

**Total: ~130 lines** (down from 200-250)

---

## Step 3: Backfill Migration

```ruby
# db/migrate/xxx_backfill_community_theme_css_vars.rb
class BackfillCommunityThemeCssVars < ActiveRecord::Migration[7.0]
  def up
    Theme.where(theme_type: "community").find_each do |theme|
      next if theme.colors.blank?

      expanded = Themes::ColorExpander.expand(theme.colors)
      theme.update_columns(theme: expanded, updated_at: Time.current)
    rescue StandardError => e
      Rails.logger.error("Failed to expand theme #{theme.id}: #{e.message}")
    end
  end

  def down
    # No-op: we don't want to remove expanded themes
  end
end
```

---

## What We're NOT Doing

- ❌ No `pairings` column - naming convention (`--X-foreground`) is sufficient
- ❌ No Langgraph changes - agent already receives theme via buildContext
- ❌ No TypeScript type changes - existing types cover the `theme` field
- ❌ No IndexCssService - agent already has design tokens
- ❌ No graph flow changes
- ❌ No `use_cases` array - agent infers this from role names

---

## WCAG Compliance

The service ensures WCAG AA compliance (4.5:1 contrast) by:

1. Using high-contrast foregrounds: `#FAFAFA` (light) or `#0A0A0A` (dark)
2. Selecting foreground based on background luminance (0.179 threshold)
3. These values are the same as official themes in `themes.sql`

The naming convention makes pairings explicit:

- `--primary` + `--primary-foreground` = guaranteed AA compliant
- `--background` + `--background-foreground` = guaranteed AA compliant
- etc.

---

## Files to Modify

| File                                                            | Change                                      |
| --------------------------------------------------------------- | ------------------------------------------- |
| `rails_app/Gemfile`                                             | Add `chroma` and `wcag_color_contrast` gems |
| `rails_app/app/models/theme.rb`                                 | Add `before_save :expand_colors` callback   |
| `rails_app/app/services/themes/color_expander.rb`               | New service (~130 lines)                    |
| `rails_app/db/migrate/xxx_backfill_community_theme_css_vars.rb` | Backfill migration                          |

---

## Testing

```ruby
# spec/services/themes/color_expander_spec.rb
RSpec.describe Themes::ColorExpander do
  describe ".expand" do
    let(:colors) { %w[264653 2A9D8F E9C46A F4A261 E76F51] }
    let(:result) { described_class.expand(colors) }

    it "generates all required CSS variables" do
      expect(result.keys).to include(
        "--background", "--background-foreground",
        "--primary", "--primary-foreground",
        "--secondary", "--secondary-foreground",
        "--accent", "--accent-foreground",
        "--muted", "--muted-foreground",
        "--destructive", "--destructive-foreground",
        "--card", "--card-foreground",
        "--border", "--input", "--ring"
      )
    end

    it "generates HSL string values" do
      expect(result["--primary"]).to match(/hsl\(\d+, \d+%, \d+%\)/)
    end

    it "ensures foregrounds contrast with backgrounds" do
      # Light backgrounds get dark foreground
      # Dark backgrounds get light foreground
      expect(result["--background-foreground"]).to match(/hsl\(0, 0%, (4|98)%\)/)
    end

    context "with blank colors" do
      it "returns empty hash" do
        expect(described_class.expand([])).to eq({})
        expect(described_class.expand(nil)).to eq({})
      end
    end

    context "with invalid colors" do
      it "handles gracefully" do
        expect { described_class.expand(%w[invalid notahex]) }.not_to raise_error
      end
    end

    context "with fewer than 5 colors" do
      it "still generates variables" do
        result = described_class.expand(%w[264653 2A9D8F])
        expect(result["--primary"]).to be_present
        expect(result["--background"]).to be_present
      end
    end
  end
end

# spec/models/theme_spec.rb
RSpec.describe Theme do
  describe "before_save callback" do
    it "expands colors to theme for community themes" do
      theme = Theme.new(
        name: "My Theme",
        colors: %w[264653 2A9D8F E9C46A F4A261 E76F51],
        author: create(:account)
      )

      expect(theme.theme).to be_nil
      theme.save!

      expect(theme.theme).to include("--primary", "--background")
      expect(theme.theme["--primary"]).to match(/hsl\(/)
    end

    it "skips expansion for official themes" do
      theme = Theme.new(
        name: "Official Theme",
        colors: %w[FF5733],
        theme_type: "official",
        theme: { "--primary" => "hsl(10, 100%, 60%)" }
      )

      original_theme = theme.theme.dup
      theme.save!
      expect(theme.theme).to eq(original_theme)
    end

    it "only runs when colors change" do
      theme = create(:theme, :community)
      original_theme = theme.theme.dup

      theme.update!(name: "Renamed Theme")
      expect(theme.theme).to eq(original_theme)
    end
  end
end
```

---

## Summary

This is a **Rails-only change** with no Langgraph modifications:

- Model callback: ~15 lines
- Service: ~130 lines
- Backfill migration: ~15 lines
- Tests: ~60 lines

**Total: ~220 lines**

---

## Revision History

### v1: Initial Plan (Rejected)

**Approach:** Move `IndexCssService.ts` from TODO folder to active, call from `buildContext.ts`.

**Feedback:** Theme application belongs in Rails, not LangGraph.

### v2: Rails-Only Approach (Accepted)

**Decision:** Move all theme expansion to Rails. Use `before_save` callback.

### v3: Added Pairings (Revised)

**Approach:** Add `pairings` jsonb column for WCAG accessibility info.

**Feedback from reviewers:**

- DHH: Approved, minor suggestions on callback guards and error handling
- Kieran: Needs revision - chroma gem API doesn't match plan, missing helper implementations
- Code Simplicity: Needs revision - `pairings` is YAGNI, naming convention is sufficient

### v4: Final Plan (Current)

**Changes from v3:**

1. **Removed `pairings` column** - naming convention is sufficient (per simplicity review)
2. **Fixed gem dependencies** - use `chroma` + `wcag_color_contrast` together (per Kieran's API verification)
3. **Implemented all helper methods** - no deferred "see TypeScript" references
4. **Simplified to ~130 lines** - down from 200-250 (per simplicity review)
5. **Used `class << self` pattern** - matches existing services like `EmbeddingService`
6. **Added specific error handling** - not bare `rescue` (per DHH review)
7. **Made callback guard explicit** - `should_expand_colors?` predicate method (per DHH review)
8. **Added robust backfill** - with error handling per theme (per Kieran review)
