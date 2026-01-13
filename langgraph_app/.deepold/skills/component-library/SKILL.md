---
name: component-library
description: Production-ready landing page components. Load this when you need specific section implementations like Features, Pricing, Testimonials, CTA, or Footer. All components use shadcn semantic colors and are fully responsive.
---

# Component Library Skill

Production-ready landing page section components. Copy and customize as needed.

## Features Section

### 3-Column Grid

```tsx
<section className="py-20 md:py-24 bg-muted">
  <div className="container mx-auto px-4 md:px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
        Everything You Need
      </h2>
      <p className="text-muted-foreground text-lg mt-4 max-w-2xl mx-auto">
        Powerful features to help you succeed
      </p>
    </div>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
      {features.map((feature, i) => (
        <div key={i} className="bg-card rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all border border-border">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
            <feature.icon className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-card-foreground">{feature.title}</h3>
          <p className="text-muted-foreground mt-2">{feature.description}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

### Featured Card Layout

```tsx
<section className="py-20 md:py-24 bg-muted">
  <div className="container mx-auto px-4 md:px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
        Why Choose Us
      </h2>
    </div>

    <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
      {/* Featured card - spans 2 columns */}
      <div className="lg:col-span-2 bg-primary rounded-3xl p-8 md:p-12 text-primary-foreground">
        <h3 className="text-2xl md:text-3xl font-bold">Main Feature Highlight</h3>
        <p className="text-primary-foreground/80 mt-4 text-lg">
          Detailed description of your most important feature
        </p>
        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          {subFeatures.map((sub, i) => (
            <div key={i} className="flex items-start gap-3">
              <Check className="w-5 h-5 text-secondary flex-shrink-0 mt-1" />
              <span>{sub}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Side cards */}
      <div className="space-y-6">
        {sideFeatures.map((feature, i) => (
          <div key={i} className="bg-card rounded-2xl p-6 shadow-lg border border-border">
            <feature.icon className="w-8 h-8 text-primary mb-4" />
            <h3 className="text-lg font-semibold text-card-foreground">{feature.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
</section>
```

## Pricing Section

### 3-Tier Pricing

```tsx
<section className="py-20 md:py-24 bg-background">
  <div className="container mx-auto px-4 md:px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
        Simple, Transparent Pricing
      </h2>
      <p className="text-muted-foreground text-lg mt-4">
        No hidden fees. Cancel anytime.
      </p>
    </div>

    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      {/* Basic */}
      <div className="bg-card rounded-2xl p-8 border border-border">
        <h3 className="text-xl font-semibold text-card-foreground">Starter</h3>
        <div className="mt-4">
          <span className="text-4xl font-bold">$19</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <ul className="mt-6 space-y-3">
          {starterFeatures.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className="w-5 h-5 text-primary" />
              <span className="text-card-foreground">{f}</span>
            </li>
          ))}
        </ul>
        <button className="w-full mt-8 bg-muted text-foreground py-3 rounded-xl font-semibold hover:bg-muted/80 transition-colors">
          Get Started
        </button>
      </div>

      {/* Pro - Featured */}
      <div className="bg-card rounded-2xl p-8 border-2 border-primary shadow-xl relative">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
          Most Popular
        </div>
        <h3 className="text-xl font-semibold text-card-foreground">Pro</h3>
        <div className="mt-4">
          <span className="text-4xl font-bold">$49</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <ul className="mt-6 space-y-3">
          {proFeatures.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className="w-5 h-5 text-primary" />
              <span className="text-card-foreground">{f}</span>
            </li>
          ))}
        </ul>
        <button className="w-full mt-8 bg-primary text-primary-foreground py-3 rounded-xl font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
          Start Free Trial
        </button>
      </div>

      {/* Enterprise */}
      <div className="bg-card rounded-2xl p-8 border border-border">
        <h3 className="text-xl font-semibold text-card-foreground">Enterprise</h3>
        <div className="mt-4">
          <span className="text-4xl font-bold">Custom</span>
        </div>
        <ul className="mt-6 space-y-3">
          {enterpriseFeatures.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className="w-5 h-5 text-primary" />
              <span className="text-card-foreground">{f}</span>
            </li>
          ))}
        </ul>
        <button className="w-full mt-8 bg-muted text-foreground py-3 rounded-xl font-semibold hover:bg-muted/80 transition-colors">
          Contact Sales
        </button>
      </div>
    </div>
  </div>
</section>
```

## Testimonials Section

### Card Grid

```tsx
<section className="py-20 md:py-24 bg-background">
  <div className="container mx-auto px-4 md:px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
        Loved by Thousands
      </h2>
    </div>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
      {testimonials.map((t, i) => (
        <div key={i} className="bg-card rounded-2xl p-6 md:p-8 shadow-lg border border-border">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-muted" /> {/* Avatar */}
            <div>
              <p className="font-semibold text-card-foreground">{t.name}</p>
              <p className="text-sm text-muted-foreground">{t.role}</p>
            </div>
          </div>
          <p className="text-card-foreground/90 italic">"{t.quote}"</p>
          <div className="flex gap-1 mt-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-secondary text-secondary" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
</section>
```

### Featured Testimonial

```tsx
<section className="py-20 md:py-24 bg-muted">
  <div className="container mx-auto px-4 md:px-6">
    <div className="max-w-4xl mx-auto text-center">
      <div className="w-20 h-20 rounded-full bg-card mx-auto mb-8 shadow-lg" /> {/* Avatar */}
      <blockquote className="text-2xl md:text-3xl font-medium text-foreground italic">
        "This product has completely transformed how we work. The results speak for themselves."
      </blockquote>
      <div className="mt-8">
        <p className="font-semibold text-foreground">Sarah Johnson</p>
        <p className="text-muted-foreground">CEO at TechCorp</p>
      </div>
    </div>
  </div>
</section>
```

## CTA Section

### Bold Full-Width

```tsx
<section className="py-20 md:py-24 bg-primary">
  <div className="container mx-auto px-4 md:px-6 text-center">
    <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground">
      Ready to Get Started?
    </h2>
    <p className="text-xl text-primary-foreground/80 mt-4 max-w-2xl mx-auto">
      Join thousands of satisfied customers today
    </p>
    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-10">
      <button className="bg-background text-foreground px-8 py-4 rounded-full font-semibold shadow-2xl hover:scale-105 transition-transform">
        Start Free Trial
      </button>
      <button className="border-2 border-primary-foreground/30 text-primary-foreground px-8 py-4 rounded-full font-semibold hover:bg-primary-foreground/10 transition-colors">
        Learn More
      </button>
    </div>
  </div>
</section>
```

## Footer Section

### Comprehensive Footer

```tsx
<footer className="py-16 md:py-20 bg-primary text-primary-foreground">
  <div className="container mx-auto px-4 md:px-6">
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
      {/* Brand */}
      <div className="lg:col-span-1">
        <h3 className="text-xl font-bold">YourBrand</h3>
        <p className="text-primary-foreground/70 mt-4">
          Making amazing things possible since 2024.
        </p>
      </div>

      {/* Links columns */}
      {footerLinks.map((col, i) => (
        <div key={i}>
          <h4 className="font-semibold mb-4">{col.title}</h4>
          <ul className="space-y-2">
            {col.links.map((link, j) => (
              <li key={j}>
                <a href={link.href} className="text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    <div className="border-t border-primary-foreground/20 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
      <p className="text-primary-foreground/60 text-sm">
        © 2024 YourBrand. All rights reserved.
      </p>
      <div className="flex gap-4">
        {socialLinks.map((social, i) => (
          <a key={i} href={social.href} className="text-primary-foreground/60 hover:text-primary-foreground transition-colors">
            <social.icon className="w-5 h-5" />
          </a>
        ))}
      </div>
    </div>
  </div>
</footer>
```

## FAQ Section

### Accordion Style

```tsx
<section className="py-20 md:py-24 bg-background">
  <div className="container mx-auto px-4 md:px-6">
    <div className="text-center mb-16">
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
        Frequently Asked Questions
      </h2>
    </div>

    <div className="max-w-3xl mx-auto space-y-4">
      {faqs.map((faq, i) => (
        <div key={i} className="bg-card rounded-xl border border-border overflow-hidden">
          <button className="w-full px-6 py-4 flex justify-between items-center text-left">
            <span className="font-semibold text-card-foreground">{faq.question}</span>
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="px-6 pb-4">
            <p className="text-muted-foreground">{faq.answer}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
</section>
```

## Stats Section

```tsx
<section className="py-16 md:py-20 bg-muted">
  <div className="container mx-auto px-4 md:px-6">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
      {stats.map((stat, i) => (
        <div key={i} className="text-center">
          <p className="text-4xl md:text-5xl font-bold text-primary">{stat.value}</p>
          <p className="text-muted-foreground mt-2">{stat.label}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

## Logo Cloud

```tsx
<section className="py-12 md:py-16 bg-background border-y border-border">
  <div className="container mx-auto px-4 md:px-6">
    <p className="text-center text-muted-foreground mb-8">Trusted by leading companies</p>
    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
      {logos.map((logo, i) => (
        <div key={i} className="h-8 w-24 bg-muted rounded" /> {/* Logo placeholder */}
      ))}
    </div>
  </div>
</section>
```
