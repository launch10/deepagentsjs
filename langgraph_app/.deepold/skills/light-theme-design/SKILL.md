---
name: light-theme-design
description: Specialized patterns for creating polished light theme landing pages. Load this when working with light color palettes. Includes shadow techniques, subtle gradients, and light-specific visual techniques.
---

# Light Theme Design Skill

Use this skill when creating landing pages with light themes (background lightness > 90%).

## Light Theme Philosophy

Light themes succeed through **depth via shadows** and **subtle color variation**. The key is creating visual interest without being harsh or overwhelming.

## Surface Hierarchy

```
Base        → bg-background (near-white, ~98% lightness)
Subtle      → bg-muted (~94% lightness)
Cards       → bg-card (pure white)
Primary     → bg-primary (bold, saturated color)
```

## Shadow Techniques (The Secret Sauce)

### Card Shadows

```tsx
// Standard card
<div className="bg-card rounded-2xl p-6 shadow-md hover:shadow-lg transition-shadow">

// Elevated card
<div className="bg-card rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow">

// Colored shadow (using primary color)
<div className="bg-card rounded-2xl p-6 shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/15">
```

### Button Shadows

```tsx
<button className="
  bg-primary text-primary-foreground
  px-8 py-4 rounded-full font-semibold
  shadow-lg shadow-primary/25
  hover:shadow-xl hover:shadow-primary/30
  hover:scale-105 transition-all
">
  Elevated CTA
</button>
```

## Subtle Gradients

### Hero Background

```tsx
<section className="min-h-[80vh] bg-gradient-to-br from-background via-muted/30 to-background relative overflow-hidden">
  {/* Soft blob accent */}
  <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl" />

  <div className="relative z-10">...</div>
</section>
```

### Section Gradients

```tsx
// Subtle top-to-bottom
<section className="py-24 bg-gradient-to-b from-background via-muted/20 to-background">

// Warm accent
<section className="py-24 bg-muted relative">
  <div className="absolute top-0 left-1/4 w-1/3 h-32 bg-secondary/5 blur-3xl" />
</section>
```

## Bold Primary Hero

For maximum impact, light themes can use bold bg-primary heroes:

```tsx
<section className="min-h-[80vh] bg-primary relative overflow-hidden">
  {/* Light gradient overlay for depth */}
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />

  <div className="container mx-auto px-4 py-24 relative z-10">
    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground">
      Bold Statement
    </h1>
    <p className="text-xl text-primary-foreground/80 mt-6 max-w-2xl">
      Supporting description
    </p>
    <button className="mt-8 bg-background text-foreground px-8 py-4 rounded-full font-semibold shadow-2xl hover:scale-105 transition-transform">
      Get Started
    </button>
  </div>
</section>
```

## Section Background Pattern

For light themes, alternate between:

```
Hero        → bg-primary (bold, attention-grabbing)
Features    → bg-muted (subtle contrast)
Benefits    → bg-background (clean)
Pricing     → bg-muted (back to subtle)
CTA         → bg-primary (bookend with hero)
Footer      → bg-muted or bg-primary
```

## Card Patterns for Light Themes

### Feature Card with Shadow

```tsx
<div className="
  bg-card rounded-2xl p-8
  shadow-lg hover:shadow-xl
  border border-border/50
  transition-shadow duration-300
">
  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
    <Icon className="w-7 h-7 text-primary" />
  </div>
  <h3 className="text-xl font-semibold text-card-foreground">Feature Title</h3>
  <p className="text-muted-foreground mt-3">Feature description</p>
</div>
```

### Pricing Card (Featured)

```tsx
<div className="
  bg-card rounded-3xl p-8
  shadow-xl border-2 border-primary
  relative transform scale-105
">
  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
    Most Popular
  </div>
  <h3 className="text-2xl font-bold text-card-foreground">Pro Plan</h3>
  <div className="mt-4">
    <span className="text-5xl font-bold">$49</span>
    <span className="text-muted-foreground">/month</span>
  </div>
  <ul className="mt-6 space-y-4">
    <li className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
        <Check className="w-4 h-4 text-primary" />
      </div>
      <span className="text-card-foreground">Feature benefit</span>
    </li>
  </ul>
  <button className="w-full mt-8 bg-primary text-primary-foreground py-4 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
    Start Free Trial
  </button>
</div>
```

## Typography in Light Themes

### Headlines

```tsx
<h1 className="text-5xl md:text-7xl font-bold text-foreground">
  Clear and <span className="text-primary">Impactful</span>
</h1>
```

### Body Text

```tsx
<p className="text-foreground">Main body text</p>
<p className="text-muted-foreground">Secondary information</p>
```

## Hover Effects for Light Themes

### Cards

```tsx
// Shadow increase
hover:shadow-xl transition-shadow

// Lift
hover:-translate-y-1 hover:shadow-xl transition-all

// Border highlight
hover:border-primary/50 transition-colors
```

### Buttons

```tsx
// Scale with shadow
hover:scale-105 hover:shadow-xl transition-all

// Color shift
hover:bg-primary/90 transition-colors
```

## Section Dividers

### Subtle Gradient Line

```tsx
<div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
```

### Decorative Accent

```tsx
<div className="flex justify-center my-16">
  <div className="w-24 h-1 bg-primary rounded-full" />
</div>
```

## Light Theme Checklist

- [ ] Cards have visible shadows (`shadow-md` or `shadow-lg`)
- [ ] Section backgrounds alternate for variety
- [ ] Primary hero has bold color (not plain white)
- [ ] Buttons have shadow depth (`shadow-lg shadow-primary/25`)
- [ ] Subtle gradients add warmth where appropriate
- [ ] Hover effects increase shadow depth
- [ ] Clean, professional appearance overall

## Common Mistakes in Light Themes

- No shadows on cards (cards look flat)
- All sections the same white background
- Hero is plain white with small text
- No hover shadow effects
- Using too many accent colors
- Harsh contrast without gradients to soften
- Cards without borders blend into muted sections
