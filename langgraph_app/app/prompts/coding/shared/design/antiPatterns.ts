/**
 * Anti-patterns gallery - specific examples of what NOT to do.
 * Visual side-by-side comparisons of bad vs good approaches.
 */
import type { CodingPromptState, CodingPromptFn } from "./types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";

export const antiPatternsPrompt: CodingPromptFn = async (
  _state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => `
## Anti-Patterns: What Makes Landing Pages Look Generic

These patterns instantly make a page look like "AI slop". Avoid them.

### ❌ The Perfectly Centered Everything

**Bad:**
\`\`\`tsx
<section className="text-center py-16">
  <h2 className="text-2xl font-medium">Our Features</h2>
  <div className="grid grid-cols-3 gap-4 mt-8">
    {/* Three identical cards, perfectly aligned */}
  </div>
</section>
\`\`\`

**Better:**
\`\`\`tsx
<section className="py-20">
  <h2 className="text-4xl font-bold mb-16">What makes us different</h2>
  <div className="grid md:grid-cols-3 gap-8">
    <div className="md:col-span-2 bg-card rounded-3xl p-8">
      {/* Featured card - larger */}
    </div>
    <div className="space-y-6">
      {/* Smaller stacked cards */}
    </div>
  </div>
</section>
\`\`\`

### ❌ The Flat White Background

**Bad:**
\`\`\`tsx
<section className="bg-white py-12">
  {/* Just flat white, no depth */}
</section>
\`\`\`

**Better:**
\`\`\`tsx
<section className="bg-gradient-to-br from-background via-muted/30 to-background py-20 relative overflow-hidden">
  <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
  <div className="relative z-10">
    {/* Content with atmosphere */}
  </div>
</section>
\`\`\`

### ❌ The Generic Button Pair

**Bad:**
\`\`\`tsx
<div className="flex gap-4">
  <button className="bg-blue-500 text-white px-4 py-2 rounded">Get Started</button>
  <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded">Learn More</button>
</div>
\`\`\`

**Better:**
\`\`\`tsx
<div className="flex flex-col sm:flex-row gap-4">
  <button className="bg-primary text-primary-foreground px-8 py-4 rounded-full font-semibold hover:scale-105 transition-transform shadow-lg shadow-primary/25">
    Start Building Free
  </button>
  <button className="text-foreground font-medium hover:text-primary transition-colors">
    See how it works →
  </button>
</div>
\`\`\`

### ❌ The Identical Card Grid

**Bad:**
\`\`\`tsx
<div className="grid grid-cols-3 gap-4">
  {features.map(f => (
    <div className="bg-gray-100 p-4 rounded">
      <Icon className="w-8 h-8 text-blue-500" />
      <h3 className="text-lg font-medium mt-2">{f.title}</h3>
      <p className="text-gray-600 mt-1">{f.desc}</p>
    </div>
  ))}
</div>
\`\`\`

**Better:**
\`\`\`tsx
<div className="grid md:grid-cols-3 gap-6">
  {features.map((f, i) => (
    <div
      key={f.title}
      className={\`rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl \${
        i === 0 ? 'bg-primary text-primary-foreground' : 'bg-card'
      }\`}
    >
      <div className="w-12 h-12 bg-secondary/20 rounded-xl flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-semibold">{f.title}</h3>
      <p className="mt-2 opacity-80">{f.desc}</p>
    </div>
  ))}
</div>
\`\`\`

### ❌ The Boring Hero

**Bad:**
\`\`\`tsx
<section className="py-16 text-center">
  <h1 className="text-3xl font-bold">Welcome to Our Product</h1>
  <p className="text-gray-600 mt-4">The best solution for your needs</p>
  <button className="bg-blue-500 text-white px-4 py-2 rounded mt-6">Get Started</button>
</section>
\`\`\`

**Better:**
\`\`\`tsx
<section className="min-h-[80vh] bg-primary relative overflow-hidden flex items-center">
  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
  <div className="absolute -top-40 -right-40 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />

  <div className="container mx-auto px-6 relative z-10">
    <span className="inline-block px-4 py-1 bg-secondary/20 text-secondary rounded-full text-sm mb-6">
      Now in beta
    </span>
    <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground max-w-4xl">
      Build products <span className="text-secondary">10x faster</span>
    </h1>
    <p className="text-xl text-primary-foreground/70 mt-6 max-w-2xl">
      The platform that turns ideas into reality. No code required.
    </p>
    <button className="mt-10 bg-background text-foreground px-8 py-4 rounded-full font-semibold hover:scale-105 transition-all shadow-lg">
      Start Free Trial
    </button>
  </div>
</section>
\`\`\`

### Quick Reference: Bad → Good

| Bad Pattern | Fix |
|-------------|-----|
| text-2xl for headlines | text-4xl to text-7xl |
| Same-size grid cards | Varied sizes, featured card |
| bg-white/bg-gray-100 | Gradients + orbs + patterns |
| rounded (small radius) | rounded-2xl, rounded-full |
| gap-4 | gap-6 or gap-8 |
| py-12/py-16 | py-20 or py-24 |
| Generic "Learn More" | Specific action + arrow |
| Static everything | hover:scale-105, transitions |
`;
