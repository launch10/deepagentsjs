/**
 * Hero section variations - bold, distinctive patterns to choose from.
 * Each hero should make an immediate impression.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const heroVariationsPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Hero Variations

Choose ONE hero style that matches your aesthetic. Don't mix patterns.

### 1. Dark Dramatic Hero

**Best for:** SaaS, tech products, premium services
**Mood:** Powerful, premium, confident

\`\`\`tsx
export function HeroDramatic() {
  return (
    <section className="min-h-screen bg-primary relative overflow-hidden">
      {/* Atmospheric elements */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-secondary/10 to-transparent" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 -left-20 w-64 h-64 bg-accent/15 rounded-full blur-3xl" />

      {/* Dot pattern overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="relative z-10 container mx-auto px-4 md:px-6 pt-32 pb-20">
        <div className="max-w-4xl">
          <span className="inline-block px-4 py-1 bg-secondary/20 text-secondary rounded-full text-sm font-medium mb-6">
            Now available
          </span>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-primary-foreground tracking-tight">
            Transform the way you{' '}
            <span className="text-secondary">build products</span>
          </h1>

          <p className="mt-6 text-xl md:text-2xl text-primary-foreground/70 max-w-2xl">
            The subheadline that explains your value proposition in one clear,
            compelling sentence.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button className="px-8 py-4 bg-secondary text-secondary-foreground rounded-full font-semibold hover:bg-secondary/90 transition-colors">
              Start Free Trial
            </button>
            <button className="px-8 py-4 bg-primary-foreground/10 text-primary-foreground rounded-full font-semibold hover:bg-primary-foreground/20 transition-colors">
              Watch Demo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
\`\`\`

### 2. Split Hero with Image

**Best for:** Products with screenshots, apps, visual services
**Mood:** Modern, balanced, professional

\`\`\`tsx
export function HeroSplit() {
  return (
    <section className="bg-background min-h-screen flex items-center">
      <div className="container mx-auto px-4 md:px-6 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="order-2 md:order-1">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              The headline that{' '}
              <span className="text-primary">captures attention</span>
            </h1>

            <p className="mt-6 text-xl text-muted-foreground">
              Supporting text that expands on the headline and communicates
              the core value proposition.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors">
                Get Started Free
              </button>
              <button className="px-6 py-3 text-foreground font-semibold hover:text-primary transition-colors">
                Learn More →
              </button>
            </div>

            {/* Social proof */}
            <div className="mt-12 flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-muted border-2 border-background" />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">2,000+</span> customers
              </p>
            </div>
          </div>

          {/* Image/Screenshot */}
          <div className="order-1 md:order-2 relative">
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-2xl" />
            <div className="relative bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
              {/* Replace with actual screenshot */}
              <div className="aspect-[4/3] bg-muted" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
\`\`\`

### 3. Centered Minimal Hero

**Best for:** Simple products, editorial, luxury brands
**Mood:** Clean, elegant, focused

\`\`\`tsx
export function HeroCentered() {
  return (
    <section className="bg-background relative overflow-hidden">
      {/* Subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/50 via-background to-background" />

      <div className="relative z-10 container mx-auto px-4 md:px-6 py-32 md:py-40">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-primary font-medium mb-4">
            Introducing Something New
          </span>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            One powerful headline
          </h1>

          <p className="mt-6 text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            A single sentence that captures everything your product does
            and why it matters.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <button className="px-8 py-4 bg-primary text-primary-foreground rounded-full font-semibold hover:bg-primary/90 transition-all hover:scale-105">
              Start Building
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
\`\`\`

### 4. Gradient Mesh Hero

**Best for:** Creative tools, modern apps, tech startups
**Mood:** Energetic, innovative, dynamic

\`\`\`tsx
export function HeroGradientMesh() {
  return (
    <section className="min-h-screen relative overflow-hidden bg-[#0a0a12]">
      {/* Gradient mesh background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/25 rounded-full blur-[80px]" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-pink-500/20 rounded-full blur-[60px]" />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

      <div className="relative z-10 container mx-auto px-4 md:px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-white/70">Now in public beta</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight">
            Build something{' '}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
              extraordinary
            </span>
          </h1>

          <p className="mt-6 text-xl text-white/60 max-w-2xl mx-auto">
            The future of creating is here. Start building with AI-powered
            tools that understand your vision.
          </p>

          <div className="mt-10">
            <button className="px-8 py-4 bg-white text-black rounded-full font-semibold hover:bg-white/90 transition-all hover:scale-105 shadow-lg shadow-white/10">
              Get Early Access
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
\`\`\`

### 5. Hero with Floating Cards

**Best for:** Multi-feature products, platforms, dashboards
**Mood:** Feature-rich, organized, trustworthy

\`\`\`tsx
export function HeroWithCards() {
  return (
    <section className="bg-muted/30 relative overflow-hidden py-20 md:py-32">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Everything you need to{' '}
            <span className="text-primary">succeed</span>
          </h1>
          <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto">
            One platform, endless possibilities.
          </p>
          <button className="mt-8 px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors">
            Start Free
          </button>
        </div>

        {/* Floating feature cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { title: 'Analytics', desc: 'Track everything' },
            { title: 'Automation', desc: 'Save hours daily' },
            { title: 'Integration', desc: 'Connect your tools' },
          ].map((feature, i) => (
            <div
              key={feature.title}
              className="bg-card rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
              style={{ animationDelay: \`\${i * 0.1}s\` }}
            >
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                <div className="w-6 h-6 bg-primary rounded" />
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
\`\`\`

### Hero Selection Guide

| Aesthetic | Recommended Hero |
|-----------|------------------|
| Dark/Dramatic | Dark Dramatic Hero |
| Minimalist | Centered Minimal Hero |
| Tech/Modern | Gradient Mesh Hero |
| Product-focused | Split Hero with Image |
| Feature-rich | Hero with Floating Cards |

### Key Hero Principles

1. **One clear headline** - Don't dilute with multiple messages
2. **One primary CTA** - Secondary CTA optional but less prominent
3. **Visual interest** - Gradient, orbs, patterns, or imagery
4. **Social proof** - Stats, logos, or avatars add credibility
5. **Breathing room** - Generous padding, don't cram content
`;
