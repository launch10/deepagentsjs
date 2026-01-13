/**
 * Complete section recipes - production-ready implementations.
 * These are copy-paste-ready patterns for each major section type.
 */
import type { CodingPromptState, CodingPromptFn } from "../types";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getThemeMode } from "../themeUtils";

const featuresRecipes = `
### Features Section Recipes

**Recipe 1: Bento Grid (Modern, Asymmetric)**
\`\`\`tsx
<section className="py-24 bg-muted">
  <div className="container mx-auto px-6">
    <div className="max-w-2xl mb-16">
      <span className="text-secondary font-semibold text-sm uppercase tracking-wider">Features</span>
      <h2 className="text-4xl md:text-5xl font-bold mt-4">
        Everything you need to <span className="text-primary">ship faster</span>
      </h2>
    </div>

    <div className="grid md:grid-cols-3 gap-6">
      {/* Large featured card */}
      <div className="md:col-span-2 bg-primary text-primary-foreground rounded-3xl p-8 md:p-12">
        <div className="w-14 h-14 bg-secondary/20 rounded-2xl flex items-center justify-center mb-6">
          <Zap className="w-7 h-7 text-secondary" />
        </div>
        <h3 className="text-2xl md:text-3xl font-bold mb-4">Lightning Fast Deployment</h3>
        <p className="text-primary-foreground/70 text-lg max-w-md">
          Deploy in seconds, not hours. Our infrastructure handles the complexity.
        </p>
      </div>

      {/* Stacked smaller cards */}
      <div className="space-y-6">
        <div className="bg-card rounded-2xl p-6 hover:shadow-lg transition-shadow">
          <Shield className="w-8 h-8 text-primary mb-4" />
          <h3 className="text-lg font-semibold mb-2">Enterprise Security</h3>
          <p className="text-muted-foreground text-sm">SOC 2 compliant out of the box</p>
        </div>
        <div className="bg-card rounded-2xl p-6 hover:shadow-lg transition-shadow">
          <BarChart className="w-8 h-8 text-primary mb-4" />
          <h3 className="text-lg font-semibold mb-2">Real-time Analytics</h3>
          <p className="text-muted-foreground text-sm">Track everything that matters</p>
        </div>
      </div>

      {/* Bottom row - three equal cards */}
      {[
        { icon: Globe, title: "Global CDN", desc: "200+ edge locations worldwide" },
        { icon: Code, title: "API First", desc: "RESTful API for everything" },
        { icon: Users, title: "Team Collaboration", desc: "Built for teams of any size" },
      ].map((feature) => (
        <div key={feature.title} className="bg-card rounded-2xl p-6 hover:-translate-y-1 transition-transform">
          <feature.icon className="w-8 h-8 text-secondary mb-4" />
          <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
          <p className="text-muted-foreground text-sm">{feature.desc}</p>
        </div>
      ))}
    </div>
  </div>
</section>
\`\`\`

**Recipe 2: Icon Cards with Hover (Clean, Professional)**
\`\`\`tsx
<section className="py-24 bg-background">
  <div className="container mx-auto px-6">
    <div className="text-center max-w-3xl mx-auto mb-16">
      <h2 className="text-4xl md:text-5xl font-bold">
        Why teams choose us
      </h2>
      <p className="text-xl text-muted-foreground mt-4">
        The tools you need to build, ship, and scale
      </p>
    </div>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {features.map((feature, i) => (
        <div
          key={feature.title}
          className="group p-8 rounded-2xl border border-border hover:border-primary/50 hover:bg-muted/50 transition-all"
        >
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:scale-110 transition-all">
            <feature.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
          <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
        </div>
      ))}
    </div>
  </div>
</section>
\`\`\`
`;

const pricingRecipes = `
### Pricing Section Recipes

**Recipe 1: Three-Tier with Highlighted Plan**
\`\`\`tsx
<section className="py-24 bg-muted">
  <div className="container mx-auto px-6">
    <div className="text-center max-w-2xl mx-auto mb-16">
      <span className="inline-block px-4 py-1 bg-secondary/20 text-secondary rounded-full text-sm font-medium mb-4">
        Pricing
      </span>
      <h2 className="text-4xl md:text-5xl font-bold">
        Simple, transparent pricing
      </h2>
      <p className="text-xl text-muted-foreground mt-4">
        No hidden fees. Cancel anytime.
      </p>
    </div>

    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      {/* Starter */}
      <div className="bg-card rounded-2xl p-8 border border-border">
        <h3 className="text-xl font-semibold mb-2">Starter</h3>
        <p className="text-muted-foreground mb-6">Perfect for side projects</p>
        <div className="mb-6">
          <span className="text-4xl font-bold">$0</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <ul className="space-y-3 mb-8">
          {["1 project", "Basic analytics", "Community support"].map((item) => (
            <li key={item} className="flex items-center gap-3">
              <Check className="w-5 h-5 text-secondary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <button className="w-full py-3 px-6 rounded-full border border-border hover:bg-muted transition-colors font-medium">
          Get Started
        </button>
      </div>

      {/* Pro - Highlighted */}
      <div className="bg-primary text-primary-foreground rounded-2xl p-8 relative scale-105 shadow-xl">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-secondary text-secondary-foreground rounded-full text-sm font-medium">
          Most Popular
        </div>
        <h3 className="text-xl font-semibold mb-2">Pro</h3>
        <p className="text-primary-foreground/70 mb-6">For growing businesses</p>
        <div className="mb-6">
          <span className="text-4xl font-bold">$29</span>
          <span className="text-primary-foreground/70">/month</span>
        </div>
        <ul className="space-y-3 mb-8">
          {["Unlimited projects", "Advanced analytics", "Priority support", "Custom domain"].map((item) => (
            <li key={item} className="flex items-center gap-3">
              <Check className="w-5 h-5 text-secondary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <button className="w-full py-3 px-6 rounded-full bg-background text-foreground hover:bg-background/90 transition-colors font-semibold">
          Start Free Trial
        </button>
      </div>

      {/* Enterprise */}
      <div className="bg-card rounded-2xl p-8 border border-border">
        <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
        <p className="text-muted-foreground mb-6">For large organizations</p>
        <div className="mb-6">
          <span className="text-4xl font-bold">Custom</span>
        </div>
        <ul className="space-y-3 mb-8">
          {["Everything in Pro", "SSO & SAML", "Dedicated support", "SLA guarantee"].map((item) => (
            <li key={item} className="flex items-center gap-3">
              <Check className="w-5 h-5 text-secondary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <button className="w-full py-3 px-6 rounded-full border border-border hover:bg-muted transition-colors font-medium">
          Contact Sales
        </button>
      </div>
    </div>
  </div>
</section>
\`\`\`
`;

const socialProofRecipes = `
### Social Proof / Testimonials Recipes

**Recipe 1: Large Quote with Company Logos**
\`\`\`tsx
<section className="py-24 bg-background">
  <div className="container mx-auto px-6">
    {/* Logo bar */}
    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 mb-20 opacity-50">
      {["Vercel", "Stripe", "Linear", "Notion", "Figma"].map((company) => (
        <span key={company} className="text-xl font-semibold text-muted-foreground">
          {company}
        </span>
      ))}
    </div>

    {/* Featured testimonial */}
    <div className="max-w-4xl mx-auto text-center">
      <blockquote className="text-2xl md:text-4xl font-medium leading-relaxed mb-8">
        "This product has completely transformed how we ship. What used to take weeks now takes hours."
      </blockquote>
      <div className="flex items-center justify-center gap-4">
        <img
          src="/avatars/sarah.jpg"
          alt="Sarah Chen"
          className="w-14 h-14 rounded-full"
        />
        <div className="text-left">
          <div className="font-semibold">Sarah Chen</div>
          <div className="text-muted-foreground">CTO at TechCorp</div>
        </div>
      </div>
    </div>
  </div>
</section>
\`\`\`

**Recipe 2: Testimonial Cards Grid**
\`\`\`tsx
<section className="py-24 bg-muted">
  <div className="container mx-auto px-6">
    <div className="text-center mb-16">
      <h2 className="text-4xl md:text-5xl font-bold">
        Loved by <span className="text-secondary">10,000+</span> teams
      </h2>
    </div>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {testimonials.map((t, i) => (
        <div
          key={i}
          className={\`bg-card rounded-2xl p-6 \${i === 0 ? 'md:col-span-2 lg:col-span-1' : ''}\`}
        >
          <div className="flex gap-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-5 h-5 fill-secondary text-secondary" />
            ))}
          </div>
          <p className="text-foreground mb-6 leading-relaxed">"{t.quote}"</p>
          <div className="flex items-center gap-3">
            <img src={t.avatar} alt={t.name} className="w-10 h-10 rounded-full" />
            <div>
              <div className="font-medium text-sm">{t.name}</div>
              <div className="text-muted-foreground text-sm">{t.role}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>
\`\`\`
`;

const ctaRecipes = `
### CTA Section Recipes

**Recipe 1: Bold Full-Width CTA**
\`\`\`tsx
<section className="py-24 bg-primary">
  <div className="container mx-auto px-6 text-center">
    <h2 className="text-4xl md:text-6xl font-bold text-primary-foreground max-w-3xl mx-auto">
      Ready to ship your next big idea?
    </h2>
    <p className="text-xl text-primary-foreground/70 mt-6 max-w-xl mx-auto">
      Join thousands of teams who've already made the switch.
    </p>
    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
      <button className="px-8 py-4 bg-background text-foreground rounded-full font-semibold hover:scale-105 transition-transform shadow-lg">
        Start Free Trial
      </button>
      <button className="px-8 py-4 text-primary-foreground font-medium hover:bg-primary-foreground/10 rounded-full transition-colors">
        Talk to Sales →
      </button>
    </div>
    <p className="text-primary-foreground/50 text-sm mt-6">
      No credit card required · 14-day free trial
    </p>
  </div>
</section>
\`\`\`

**Recipe 2: CTA with Floating Card**
\`\`\`tsx
<section className="py-24 bg-muted relative overflow-hidden">
  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

  <div className="container mx-auto px-6 relative">
    <div className="bg-primary rounded-3xl p-12 md:p-16 text-center relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/20 rounded-full blur-2xl" />

      <div className="relative z-10">
        <span className="inline-block px-4 py-1 bg-secondary/20 text-secondary rounded-full text-sm font-medium mb-6">
          Limited Time Offer
        </span>
        <h2 className="text-3xl md:text-5xl font-bold text-primary-foreground mb-6">
          Get 3 months free
        </h2>
        <p className="text-primary-foreground/70 text-lg max-w-md mx-auto mb-8">
          Sign up today and get your first 3 months on us.
        </p>
        <button className="px-10 py-4 bg-background text-foreground rounded-full font-semibold hover:scale-105 transition-transform shadow-xl">
          Claim Your Offer
        </button>
      </div>
    </div>
  </div>
</section>
\`\`\`
`;

const footerRecipes = `
### Footer Recipes

**Recipe 1: Bold Dark Footer**
\`\`\`tsx
<footer className="bg-primary text-primary-foreground py-16">
  <div className="container mx-auto px-6">
    <div className="grid md:grid-cols-4 gap-12 mb-12">
      {/* Brand */}
      <div className="md:col-span-1">
        <div className="text-2xl font-bold mb-4">YourBrand</div>
        <p className="text-primary-foreground/70 text-sm">
          Building the future of product development.
        </p>
      </div>

      {/* Links */}
      {[
        { title: "Product", links: ["Features", "Pricing", "Changelog", "Roadmap"] },
        { title: "Company", links: ["About", "Blog", "Careers", "Press"] },
        { title: "Resources", links: ["Docs", "Help Center", "Community", "Status"] },
      ].map((section) => (
        <div key={section.title}>
          <h4 className="font-semibold mb-4">{section.title}</h4>
          <ul className="space-y-3">
            {section.links.map((link) => (
              <li key={link}>
                <a href="#" className="text-primary-foreground/70 hover:text-primary-foreground transition-colors text-sm">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    {/* Bottom bar */}
    <div className="pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row justify-between items-center gap-4">
      <p className="text-primary-foreground/50 text-sm">
        © 2024 YourBrand. All rights reserved.
      </p>
      <div className="flex gap-6">
        {["Twitter", "GitHub", "LinkedIn"].map((social) => (
          <a key={social} href="#" className="text-primary-foreground/50 hover:text-primary-foreground transition-colors text-sm">
            {social}
          </a>
        ))}
      </div>
    </div>
  </div>
</footer>
\`\`\`

**Recipe 2: Minimal Light Footer**
\`\`\`tsx
<footer className="bg-background border-t border-border py-12">
  <div className="container mx-auto px-6">
    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="text-xl font-bold">YourBrand</div>

      <nav className="flex flex-wrap justify-center gap-8">
        {["Product", "Pricing", "About", "Blog", "Contact"].map((link) => (
          <a key={link} href="#" className="text-muted-foreground hover:text-foreground transition-colors text-sm">
            {link}
          </a>
        ))}
      </nav>

      <p className="text-muted-foreground text-sm">
        © 2024 YourBrand
      </p>
    </div>
  </div>
</footer>
\`\`\`
`;

export const sectionRecipesPrompt: CodingPromptFn = async (
  state: CodingPromptState,
  _config?: LangGraphRunnableConfig
): Promise<string> => {
  const themeMode = getThemeMode(state);

  const intro = `
## Section Recipes: Production-Ready Patterns

These are complete, tested section implementations. Use them as starting points and customize for the specific content.

**Theme detected: ${themeMode === "unknown" ? "Not specified" : themeMode.toUpperCase()}**
${themeMode === "dark" ? "→ Favor recipes with glowing effects and atmospheric elements" : ""}
${themeMode === "light" ? "→ Favor recipes with shadows and clean backgrounds" : ""}
`;

  return `${intro}
${featuresRecipes}
${pricingRecipes}
${socialProofRecipes}
${ctaRecipes}
${footerRecipes}
`;
};
