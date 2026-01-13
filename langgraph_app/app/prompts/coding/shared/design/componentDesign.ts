/**
 * Component-specific design guidance for creating distinctive sections.
 * Each section type has patterns to make it bold and memorable.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const componentDesignPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Component Design Patterns

### Hero Section: Make It DRAMATIC

The hero is your one chance to hook visitors. Make it unforgettable.

**Bold patterns:**
\`\`\`tsx
// Full-viewport hero with gradient overlay
<section className="min-h-screen bg-primary relative overflow-hidden">
  {/* Atmospheric glow */}
  <div className="absolute top-1/4 -right-32 w-96 h-96 bg-secondary/30 rounded-full blur-3xl" />
  <div className="absolute bottom-1/4 -left-32 w-64 h-64 bg-accent/20 rounded-full blur-3xl" />

  <div className="relative z-10 container mx-auto px-6 pt-32 pb-20">
    <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground max-w-4xl">
      The headline that <span className="text-secondary">demands attention</span>
    </h1>
  </div>
</section>

// Split hero with asymmetric layout
<section className="bg-background">
  <div className="container mx-auto grid md:grid-cols-5 gap-8 min-h-[80vh] items-center">
    <div className="md:col-span-3 space-y-6">
      {/* Content takes more space */}
    </div>
    <div className="md:col-span-2 relative">
      {/* Image/illustration offset */}
      <div className="absolute -right-12 -top-12 w-full h-full bg-primary/10 rounded-3xl" />
      <img className="relative z-10 rounded-2xl shadow-2xl" />
    </div>
  </div>
</section>
\`\`\`

**Hero must-haves:**
- Headline: text-5xl minimum, preferably text-6xl or text-7xl
- One colored word/phrase in the headline using text-secondary or text-accent
- At least one atmospheric element (gradient orb, pattern, or texture)
- Clear visual hierarchy: headline → subhead → CTA

### Features Section: Show Don't Tell

Features are boring when they're just icon + title + description grids. Make them visual.

**Bold patterns:**
\`\`\`tsx
// Bento grid with varied sizes
<section className="bg-muted py-24">
  <div className="container mx-auto px-6">
    <div className="grid md:grid-cols-3 gap-6">
      {/* Large featured card spanning 2 columns */}
      <div className="md:col-span-2 bg-card rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent" />
        {/* Main feature content */}
      </div>

      {/* Stacked smaller cards */}
      <div className="space-y-6">
        <div className="bg-card rounded-2xl p-6 hover:shadow-lg transition-shadow">
          {/* Feature 2 */}
        </div>
        <div className="bg-primary rounded-2xl p-6 text-primary-foreground">
          {/* Feature 3 - highlighted */}
        </div>
      </div>
    </div>
  </div>
</section>

// Features with numbers/stats
<div className="flex items-start gap-4">
  <span className="text-6xl font-bold text-primary/20">01</span>
  <div>
    <h3 className="text-xl font-semibold">Feature Title</h3>
    <p className="text-muted-foreground">Description</p>
  </div>
</div>
\`\`\`

**Feature must-haves:**
- Vary card sizes - not all cards should be identical
- Include at least one "featured" or highlighted card
- Use numbers, stats, or icons creatively
- Add subtle hover states for interactivity

### Pricing Section: Clear Value Hierarchy

Pricing needs to guide the eye to your preferred plan.

**Bold patterns:**
\`\`\`tsx
// Highlighted middle plan
<div className="grid md:grid-cols-3 gap-8 items-start">
  {/* Basic plan - normal */}
  <div className="bg-card rounded-2xl p-8">
    {/* Content */}
  </div>

  {/* Pro plan - HIGHLIGHTED */}
  <div className="bg-primary rounded-2xl p-8 text-primary-foreground relative -mt-4 md:-mt-8 shadow-2xl">
    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-secondary px-4 py-1 rounded-full text-sm font-medium">
      Most Popular
    </div>
    {/* Content */}
  </div>

  {/* Enterprise - normal */}
  <div className="bg-card rounded-2xl p-8">
    {/* Content */}
  </div>
</div>
\`\`\`

**Pricing must-haves:**
- One plan MUST be visually emphasized (scale, color, or position)
- Use badges like "Most Popular" or "Best Value"
- Clear price typography: large price, small period
- Feature lists with checkmarks

### Social Proof: Build Credibility

Testimonials and logos need visual weight.

**Bold patterns:**
\`\`\`tsx
// Quote with visual emphasis
<blockquote className="relative">
  <div className="text-8xl text-primary/20 absolute -top-4 -left-4">"</div>
  <p className="text-xl md:text-2xl font-medium relative z-10 pl-8">
    This product changed everything for our business...
  </p>
  <footer className="mt-6 flex items-center gap-4 pl-8">
    <img className="w-12 h-12 rounded-full" src="..." />
    <div>
      <cite className="font-semibold not-italic">Name</cite>
      <p className="text-muted-foreground text-sm">Title, Company</p>
    </div>
  </footer>
</blockquote>

// Logo cloud with hover effects
<div className="flex flex-wrap justify-center items-center gap-12 opacity-60 hover:opacity-100 transition-opacity">
  {logos.map(logo => (
    <img key={logo} className="h-8 grayscale hover:grayscale-0 transition-all" />
  ))}
</div>
\`\`\`

**Social proof must-haves:**
- Large quote marks or distinctive styling for testimonials
- Real photos (or avatars) with names and titles
- Logo clouds should be subtle (grayscale, lower opacity)
- Stats/numbers should be BIG: "10,000+ customers"

### CTA Section: Urgency and Action

The final CTA should be impossible to ignore.

**Bold patterns:**
\`\`\`tsx
// Full-width dramatic CTA
<section className="bg-primary py-24 relative overflow-hidden">
  {/* Background pattern */}
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1)_0%,transparent_50%)]" />

  <div className="container mx-auto px-6 text-center relative z-10">
    <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
      Ready to get started?
    </h2>
    <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
      Join thousands of customers who...
    </p>
    <button className="bg-background text-foreground hover:bg-background/90 px-8 py-4 rounded-full text-lg font-semibold shadow-lg hover:shadow-xl transition-all">
      Start Free Trial
    </button>
  </div>
</section>
\`\`\`

**CTA must-haves:**
- Use bg-primary for visual weight
- Button should CONTRAST with section background
- Single, clear action (not multiple buttons)
- Create urgency in copy without being pushy

### Footer: Professional Close

Footer should feel intentional, not like an afterthought.

**Bold patterns:**
\`\`\`tsx
// Structured footer with visual interest
<footer className="bg-primary text-primary-foreground pt-16 pb-8">
  <div className="container mx-auto px-6">
    <div className="grid md:grid-cols-4 gap-12 mb-12">
      {/* Brand column */}
      <div className="md:col-span-2">
        <Logo className="h-8 mb-4" />
        <p className="text-primary-foreground/70 max-w-md">
          Brief company description that reinforces value prop.
        </p>
      </div>

      {/* Link columns */}
      <div>
        <h4 className="font-semibold mb-4">Product</h4>
        <ul className="space-y-2 text-primary-foreground/70">
          {/* Links */}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold mb-4">Company</h4>
        <ul className="space-y-2 text-primary-foreground/70">
          {/* Links */}
        </ul>
      </div>
    </div>

    <div className="border-t border-primary-foreground/20 pt-8 flex justify-between items-center">
      <p className="text-sm text-primary-foreground/60">© 2024 Company</p>
      {/* Social icons */}
    </div>
  </div>
</footer>
\`\`\`

**Footer must-haves:**
- Match hero background (bg-primary) for visual bookending
- Clear column structure
- Subtle separator line
- Copyright and legal links
`;
