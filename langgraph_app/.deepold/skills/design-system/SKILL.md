---
name: design-system
description: Comprehensive design system for creating bold, memorable landing pages. Load this skill when building or reviewing landing page designs. Includes color rules, typography scales, layout patterns, and quality checklist.
---

# Design System Skill

Use this skill when creating or reviewing landing page designs to ensure bold, distinctive visual output.

## Core Philosophy

**Every landing page needs ONE thing someone will remember.**

Don't create generic "AI slop" - create pages that look like they were made by a skilled designer.

## Color Strategy: The 60-30-10 Rule

```
60% Dominant   → bg-background, bg-muted (most of page)
30% Secondary  → bg-primary (hero, CTA, footer)
10% Accent     → text-secondary, badges, highlights
```

### Section Backgrounds (CRITICAL)

Only these are valid for full-width sections:

| Section | Background | Text |
|---------|------------|------|
| Hero | `bg-primary` | `text-primary-foreground` |
| Features | `bg-muted` | `text-foreground` |
| Social Proof | `bg-background` | `text-foreground` |
| Pricing | `bg-muted` or `bg-background` | `text-foreground` |
| CTA | `bg-primary` | `text-primary-foreground` |
| Footer | `bg-primary` | `text-primary-foreground` |

**NEVER use `bg-secondary` or `bg-accent` for sections** - they're for buttons and badges only.

### Card Surface Harmony

Cards must contrast with their section:

| Section Background | Card Background |
|-------------------|-----------------|
| `bg-primary` | `bg-card` or `bg-background` |
| `bg-muted` | `bg-card` |
| `bg-background` | `bg-card` |

**Rule**: Card should ALWAYS differ from section background.

## Typography Scale

### Responsive Headlines

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Hero H1 | `text-3xl` | `text-5xl` | `text-7xl` |
| Section H2 | `text-2xl` | `text-4xl` | `text-5xl` |
| Card H3 | `text-lg` | `text-xl` | `text-2xl` |
| Body | `text-base` | `text-lg` | `text-lg` |

### Text Colors

- Primary headlines: `text-foreground` (or `text-primary-foreground` on `bg-primary`)
- Body text: `text-foreground` or `text-muted-foreground`
- Accents: `text-secondary` for key words
- Links: `text-primary` with `hover:underline`

## Spacing Scale

### Section Padding

```tsx
// Mobile → Tablet → Desktop
py-16 md:py-20 lg:py-24
```

### Element Gaps

```tsx
gap-4 md:gap-6 lg:gap-8
```

### Container

```tsx
<div className="container mx-auto px-4 md:px-6">
```

## Hero Patterns

### Pattern 1: Bold Full-Width

```tsx
<section className="min-h-[80vh] bg-primary relative overflow-hidden">
  {/* Atmospheric orbs */}
  <div className="absolute -top-20 -right-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
  <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />

  <div className="container mx-auto px-4 py-24 relative z-10">
    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground max-w-4xl">
      Bold Headline That <span className="text-secondary">Grabs Attention</span>
    </h1>
    <p className="text-xl text-primary-foreground/80 mt-6 max-w-2xl">
      Supporting description that adds context
    </p>
    <div className="flex gap-4 mt-8">
      <button className="bg-secondary text-secondary-foreground px-8 py-4 rounded-full font-semibold hover:scale-105 transition-transform">
        Primary CTA
      </button>
    </div>
  </div>
</section>
```

### Pattern 2: Split with Visual

```tsx
<section className="min-h-screen bg-primary">
  <div className="container mx-auto px-4 py-24 grid lg:grid-cols-2 gap-12 items-center">
    <div>
      <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-foreground">
        Compelling Value Proposition
      </h1>
      <p className="text-xl text-primary-foreground/80 mt-6">
        Clear, benefit-focused description
      </p>
      <button className="mt-8 bg-secondary text-secondary-foreground px-8 py-4 rounded-full">
        Get Started
      </button>
    </div>
    <div className="bg-card rounded-3xl p-8 shadow-2xl">
      {/* Product visual or screenshot */}
    </div>
  </div>
</section>
```

## Card Patterns

### Feature Card

```tsx
<div className="bg-card rounded-2xl p-6 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all border border-border">
  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
    <Icon className="w-6 h-6 text-primary" />
  </div>
  <h3 className="text-xl font-semibold text-card-foreground">Feature Title</h3>
  <p className="text-muted-foreground mt-2">Feature description</p>
</div>
```

### Pricing Card (Featured)

```tsx
<div className="bg-card rounded-3xl p-8 shadow-xl border-2 border-primary relative">
  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
    Most Popular
  </div>
  <h3 className="text-2xl font-bold text-card-foreground">Pro Plan</h3>
  <div className="mt-4">
    <span className="text-4xl font-bold">$49</span>
    <span className="text-muted-foreground">/month</span>
  </div>
  <ul className="mt-6 space-y-3">
    <li className="flex items-center gap-2">
      <Check className="w-5 h-5 text-primary" />
      <span>Feature one</span>
    </li>
  </ul>
  <button className="w-full mt-8 bg-primary text-primary-foreground py-3 rounded-xl font-semibold hover:bg-primary/90">
    Start Free Trial
  </button>
</div>
```

## Hover Effects

### Buttons

```tsx
// Standard
hover:bg-primary/90 transition-colors

// Scale
hover:scale-105 transition-transform

// Glow (dark themes)
hover:shadow-lg hover:shadow-primary/30 transition-all
```

### Cards

```tsx
// Lift
hover:-translate-y-1 hover:shadow-xl transition-all

// Glow border
hover:border-primary/50 transition-colors
```

## Atmospheric Elements

### Gradient Orbs (Dark Theme)

```tsx
<div className="absolute -top-20 -right-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />
```

### Subtle Gradients (Light Theme)

```tsx
<section className="bg-gradient-to-br from-background via-muted/30 to-background">
```

### Section Dividers

```tsx
<div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
```

## Quality Checklist

Before completing any landing page, verify:

### Must Pass

- [ ] Hero has `bg-primary` (not white/neutral)
- [ ] Headlines are `text-4xl`+ on mobile, `text-5xl`+ on desktop
- [ ] Section backgrounds alternate (not all the same)
- [ ] Cards contrast with their section background
- [ ] Buttons have hover effects
- [ ] Spacing is generous (`py-20`+, `gap-6`+)

### Red Flags (Auto-Fail)

- All sections have `bg-background`
- Hero headline is `text-2xl` or smaller
- Cards have same background as section
- No hover effects anywhere
- Using `bg-secondary` for full sections
- Identical cards in perfect grid

### Memorability Test

Ask: "Would someone remember this page after 3 seconds?"

If no, add ONE memorable element:
- Dramatic `bg-primary` hero
- Interesting layout asymmetry
- Bold typography treatment
- Atmospheric gradient orbs
- Creative CTA phrasing
