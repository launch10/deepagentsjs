# Fix Theme Generation: Why Landing Pages Look INSANE

## Problem

The generated landing page has **overwhelming, aggressive colors** - vibrant yellow backgrounds, orange sections with yellow cards, visual chaos.

The 5-color palette looks great in the playground. But when applied to a landing page, it's unreadable.

Screenshot evidence: Yellow (E9C46A) as page background, orange (F4A261) sections, yellow cards on orange - pure chaos.

## Root Cause Summary

**Palette colors should be ACCENT colors, not background colors.**

The algorithm assigns the brightest palette color as the page background. But a vibrant 74% saturated yellow isn't a background - it's a highlight color.

---

## Technical Diagnosis

### The Pipeline

```
5 hex colors → semantic_variables.rb → CSS variables → AI prompt → React components
```

### Breaking Point 1: Wrong background selection

**File**: `rails_app/app/models/concerns/theme_concerns/semantic_variables.rb`
**Lines**: 118-121

```ruby
sorted_by_luminance = analyzed.sort_by { |c| -c[:luminance] }
background = sorted_by_luminance.first
```

**Problem**: Picks highest luminance = background. For palette `264653, 2A9D8F, E9C46A, F4A261, E76F51`:
- E9C46A (yellow) has highest luminance → becomes background
- But it's **74% saturated** - that's an accent, not a background!

**Result in CSS**:
```css
--background: 43 74% 66%;  /* Screaming yellow */
```

### Breaking Point 2: Card = Background

**File**: `rails_app/app/models/concerns/theme_concerns/semantic_variables.rb`
**Line**: 134

```ruby
card: background[:hex]
```

Card color = Background color = same yellow. Cards are invisible on the page.

**Result in CSS**:
```css
--background: 43 74% 66%;
--card: 43 74% 66%;  /* IDENTICAL */
```

### Breaking Point 3: No surface harmony guidance

**File**: `rails_app/app/models/concerns/theme_concerns/typography_recommendations.rb`

Typography recommendations only cover TEXT colors:
```
On #E9C46A background:
  Headlines: #264653, #0A0A0A
  Body: #0A0A0A
```

**Missing**: Guidance on which SURFACES work together. The AI puts `bg-card` (yellow) inside `bg-secondary` (orange) sections = chaos.

### Breaking Point 4: Prompt encourages wrong behavior

**File**: `langgraph_app/app/prompts/coding/shared/themeColors.ts`
**Line**: 28

```typescript
"You should try to vary the background colors of subsequent sections"
```

AI interprets this as "use bg-primary, bg-secondary, bg-accent as section backgrounds." But those were meant for buttons/badges, not full-width sections.

---

## The Fix

### Core Principle

**Palette colors are ACCENT colors, not background colors.**

A 5-color palette contains colors for buttons, badges, and highlights. None should be the page background.

### Fix 1: Derive neutral background

Instead of picking from the palette, DERIVE a near-neutral:

```ruby
def derive_neutral_background(colors, is_dark_palette)
  # Take dominant color's hue for tinting
  dominant = colors.max_by { |c| c[:saturation] }
  hue = Chroma.paint("##{dominant[:hex]}").hsl.h

  if is_dark_palette
    # Near-black with hint of palette hue
    Chroma.paint("hsl(#{hue}, 15%, 8%)")
  else
    # Near-white with hint of palette hue
    Chroma.paint("hsl(#{hue}, 8%, 97%)")
  end
end
```

**Result**: Background is neutral but "on brand" via hue tinting.

### Fix 2: Card differs from background

```ruby
def derive_card_color(background, is_dark)
  if is_dark
    # Slightly lighter than background
    Chroma.paint("##{background}").lighten(5)
  else
    # Pure white
    "FFFFFF"
  end
end
```

### Fix 3: Add variety suggestions to prompt

Instead of just restricting, give the AI positive guidance on how to create visual variety:

```typescript
## Section Backgrounds & Visual Variety

### Primary Approach: Use semantic variables with variety
Create visual rhythm by alternating between these safe section backgrounds:

| Section Type | Background | Cards/Elements | Example |
|--------------|------------|----------------|---------|
| Default sections | bg-background | bg-card, bg-muted | Features, testimonials |
| Subtle variation | bg-muted | bg-card, bg-background | Alternate features |
| Bold statements | bg-primary | bg-card, bg-background | Hero, CTA, footer |
| Accent moments | bg-accent (sparingly) | bg-background | Single highlight section |

### Visual Hierarchy Pattern
A good landing page follows this rhythm:
1. **Hero**: bg-primary (dark, dramatic) OR bg-background with hero image
2. **Features**: bg-muted (subtle contrast from hero)
3. **Social proof**: bg-background (clean, let content shine)
4. **Pricing**: bg-muted OR bg-background
5. **CTA**: bg-primary (bookend with hero)
6. **Footer**: bg-primary or muted dark

### Cards on Colored Backgrounds
When your section uses a colored background (bg-primary, bg-accent):
- Use bg-card or bg-background for inner cards
- This creates the "lifted" card effect
- Never use the same color as the section for cards

### Raw Hex Colors for Accents
You can use the palette colors directly for small accents:
- Headlines on neutral backgrounds: \`text-[#HEX]\`
- Icon backgrounds: \`bg-[#HEX]/10\` (10% opacity)
- Borders: \`border-[#HEX]/20\`
```

### Fix 4: Fallback - Let AI generate index.css

If semantic variables continue to produce poor results, the AI can generate `src/index.css` directly from the 6 palette colors:

```typescript
// In prompt:
If the semantic theme variables don't look right, you can override them.
Generate a custom index.css with better assignments:

1. Pick the most neutral color (highest lightness, lowest saturation) for --background
2. Use white (FAFAFA) or near-white for --card
3. Pick the darkest color for --primary (hero/CTA backgrounds)
4. Reserve vibrant colors for --accent (buttons, badges)

Example index.css generation:
\`\`\`css
:root {
  --background: hsl(43 8% 97%);   /* Derived neutral */
  --card: hsl(0 0% 100%);         /* Pure white */
  --primary: hsl(197 37% 24%);    /* Dark teal from palette */
  --secondary: hsl(27 60% 67%);   /* Orange, but for buttons only */
  /* ... */
}
\`\`\`
```

This gives the AI agency to fix bad semantic assignments while staying within the design system.

---

## Files to Modify

| File | Change |
|------|--------|
| `rails_app/app/models/concerns/theme_concerns/semantic_variables.rb` | Derive neutral background, fix card assignment |
| `langgraph_app/app/prompts/coding/shared/themeColors.ts` | Restrict section background choices |

## Expected Result

For palette `264653, 2A9D8F, E9C46A, F4A261, E76F51`:

**Before**:
```css
--background: 43 74% 66%;   /* Yellow - WRONG */
--card: 43 74% 66%;         /* Same yellow - WRONG */
```

**After**:
```css
--background: 43 8% 97%;    /* Near-white with yellow tint */
--card: 0 0% 100%;          /* Pure white */
--primary: 197 37% 24%;     /* Dark teal (actual palette color) */
--secondary: 27 87% 67%;    /* Orange (for buttons, not sections) */
```

The page will be neutral and readable. Palette colors appear as button fills, badges, and accents - where they belong.
