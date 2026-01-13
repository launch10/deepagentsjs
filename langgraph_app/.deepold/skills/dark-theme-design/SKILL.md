---
name: dark-theme-design
description: Specialized patterns for creating stunning dark theme landing pages. Load this when working with dark color palettes. Includes glow effects, atmospheric orbs, and dark-specific visual techniques.
---

# Dark Theme Design Skill

Use this skill when creating landing pages with dark themes (background lightness < 30%).

## Dark Theme Philosophy

Dark themes succeed through **luminous accents on deep backgrounds**. The key is creating depth and glow without being harsh.

## Surface Hierarchy

```
Deepest     → bg-background (near-black, ~8% lightness)
Elevated    → bg-muted (~15% lightness)
Cards       → bg-card (~12% lightness)
Primary     → bg-primary (darkest saturated color)
```

## Glow Effects (The Secret Sauce)

### Button Glow

```tsx
<button className="
  bg-secondary text-secondary-foreground
  px-8 py-4 rounded-full font-semibold
  shadow-lg shadow-secondary/30
  hover:shadow-xl hover:shadow-secondary/40
  hover:scale-105 transition-all
">
  Glowing CTA
</button>
```

### Card Glow

```tsx
<div className="
  bg-card rounded-2xl p-6
  border border-border
  shadow-lg shadow-primary/10
  hover:shadow-xl hover:shadow-primary/20
  transition-shadow
">
```

### Icon Container Glow

```tsx
<div className="
  w-12 h-12 rounded-xl
  bg-primary/20
  flex items-center justify-center
  shadow-lg shadow-primary/20
">
  <Icon className="w-6 h-6 text-primary" />
</div>
```

## Atmospheric Orbs

Essential for creating depth in dark themes.

### Hero Background Orbs

```tsx
<section className="min-h-[80vh] bg-primary relative overflow-hidden">
  {/* Top-right glow - secondary color */}
  <div className="absolute -top-20 -right-20 w-96 h-96 bg-secondary/30 rounded-full blur-3xl" />

  {/* Bottom-left glow - accent color */}
  <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-accent/20 rounded-full blur-3xl" />

  {/* Content above orbs */}
  <div className="relative z-10">...</div>
</section>
```

### Section Corner Accents

```tsx
<section className="py-24 bg-background relative overflow-hidden">
  {/* Subtle corner orbs */}
  <div className="absolute top-10 right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
  <div className="absolute bottom-10 left-10 w-24 h-24 bg-secondary/5 rounded-full blur-xl" />

  <div className="relative z-10 container mx-auto px-4">...</div>
</section>
```

### Animated Orbs

```tsx
<div className="absolute top-20 right-20 w-32 h-32 bg-accent/15 rounded-full blur-2xl animate-pulse" />
```

## Gradient Mesh Background

For complex atmospheric effects:

```tsx
<section className="bg-gradient-to-br from-primary via-primary to-[hsl(var(--primary)/0.8)] relative">
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--secondary)/0.15),transparent_50%)]" />
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--accent)/0.1),transparent_50%)]" />
  <div className="relative z-10">...</div>
</section>
```

## Border Definition

Dark themes need subtle borders for depth:

```tsx
// Cards
<div className="bg-card border border-border rounded-2xl">

// Elevated surfaces
<div className="bg-muted border border-border/50 rounded-xl">

// Glowing border on hover
<div className="border border-border hover:border-primary/50 transition-colors">
```

## Section Dividers

### Gradient Line

```tsx
<div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
```

### Glowing Divider

```tsx
<div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
```

## Typography in Dark Themes

### Headlines

```tsx
<h1 className="text-5xl md:text-7xl font-bold text-primary-foreground">
  Headline with <span className="text-secondary">Accent Word</span>
</h1>
```

### Body Text

```tsx
<p className="text-primary-foreground/80">
  Slightly reduced opacity for comfortable reading
</p>
```

### Muted Text

```tsx
<p className="text-muted-foreground">
  Secondary information
</p>
```

## Hero Patterns for Dark Themes

### Dramatic Glow Hero

```tsx
<section className="min-h-screen bg-primary relative overflow-hidden">
  {/* Multiple orbs for complex glow */}
  <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-secondary/20 rounded-full blur-[100px]" />
  <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-accent/15 rounded-full blur-[80px]" />

  <div className="container mx-auto px-4 py-32 relative z-10 text-center">
    <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground">
      Make Something <span className="text-secondary">Unforgettable</span>
    </h1>
    <p className="text-xl text-primary-foreground/70 mt-6 max-w-2xl mx-auto">
      Create landing pages that captivate from the first glance
    </p>
    <button className="mt-10 bg-secondary text-secondary-foreground px-10 py-5 rounded-full text-lg font-semibold shadow-2xl shadow-secondary/40 hover:shadow-secondary/50 hover:scale-105 transition-all">
      Get Started Free
    </button>
  </div>
</section>
```

## Card Patterns for Dark Themes

### Glowing Feature Card

```tsx
<div className="
  group bg-card rounded-2xl p-8
  border border-border
  shadow-lg shadow-primary/5
  hover:shadow-xl hover:shadow-primary/15
  hover:border-primary/30
  transition-all duration-300
">
  <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mb-6 group-hover:bg-primary/30 transition-colors">
    <Icon className="w-7 h-7 text-primary" />
  </div>
  <h3 className="text-xl font-semibold text-card-foreground">Feature Name</h3>
  <p className="text-muted-foreground mt-3">Feature description with benefits</p>
</div>
```

### Testimonial Card

```tsx
<div className="bg-card rounded-3xl p-8 border border-border">
  <div className="flex items-center gap-4 mb-6">
    <div className="w-12 h-12 rounded-full bg-muted" /> {/* Avatar placeholder */}
    <div>
      <p className="font-semibold text-card-foreground">Jane Smith</p>
      <p className="text-sm text-muted-foreground">CEO at Company</p>
    </div>
  </div>
  <p className="text-lg text-card-foreground/90 italic">
    "This product transformed how we work..."
  </p>
</div>
```

## Dark Theme Checklist

- [ ] Using glow effects on buttons (`shadow-lg shadow-color/30`)
- [ ] Atmospheric orbs in hero section
- [ ] Cards have subtle borders (`border border-border`)
- [ ] Primary sections have gradient orbs
- [ ] Text hierarchy uses opacity (`text-primary-foreground/80`)
- [ ] Hover effects include glow intensification
- [ ] No pure white elements (use `text-primary-foreground`)

## Common Mistakes in Dark Themes

- Using pure white (`#FFFFFF`) - use `text-primary-foreground` instead
- Flat backgrounds without atmospheric elements
- Missing borders on cards (cards blend into background)
- No glow on interactive elements
- Using same opacity for all text
- Orbs that are too opaque (keep under `/30`)
