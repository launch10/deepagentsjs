/**
 * Seed data for file specifications based on standard components
 */

// Section Components
export const FILE_SPEC_SEEDS = {
  Hero: {
    canonicalPath: 'src/components/Hero.tsx',
    description: "Choose when the user wants a prominent header section at the top of the page. Ideal for main headlines, value propositions, and primary call-to-action buttons. Also appropriate for 'above the fold', 'header', or 'banner' requests.",
    filetype: 'Section',
    componentType: 'Hero',
    language: 'tsx'
  },
  Benefits: {
    canonicalPath: 'src/components/Benefits.tsx',
    description: "Choose when the user wants to highlight advantages, key features, or value propositions. Good for 'why choose us', 'advantages', 'key points', or 'what you get' sections.",
    filetype: 'Section',
    componentType: 'Benefits',
    language: 'tsx'
  },
  CTA: {
    canonicalPath: 'src/components/CTA.tsx',
    description: "Choose for call-to-action sections that drive user engagement. Ideal for 'sign up', 'get started', 'contact us', or any conversion-focused section that prompts immediate action.",
    filetype: 'Section',
    componentType: 'CTA',
    language: 'tsx'
  },
  Custom: {
    canonicalPath: 'src/components/Custom.tsx',
    description: "Choose when the user's request doesn't fit any other predefined section types or requires highly specialized, unique functionality.",
    filetype: 'Section',
    componentType: 'Custom',
    language: 'tsx'
  },
  FAQ: {
    canonicalPath: 'src/components/FAQ.tsx',
    description: "Choose when the user wants to address common questions, concerns, or provide help information. Good for 'frequently asked questions', 'help', 'support', or 'common questions' sections.",
    filetype: 'Section',
    componentType: 'FAQ',
    language: 'tsx'
  },
  Features: {
    canonicalPath: 'src/components/Features.tsx',
    description: "Choose when the user wants to showcase specific product or service features, capabilities, or functionalities. Good for 'what we offer', 'capabilities', or detailed product/service breakdowns.",
    filetype: 'Section',
    componentType: 'Features',
    language: 'tsx'
  },
  HowItWorks: {
    canonicalPath: 'src/components/HowItWorks.tsx',
    description: "Choose when the user wants to explain processes, steps, or workflows. Ideal for 'process', 'steps', 'how to use', or any section explaining sequential information.",
    filetype: 'Section',
    componentType: 'HowItWorks',
    language: 'tsx'
  },
  Testimonials: {
    canonicalPath: 'src/components/Testimonials.tsx',
    description: "Choose when the user wants to showcase customer reviews, feedback, or endorsements. Good for 'reviews', 'what people say', 'client feedback', or 'endorsements' sections.",
    filetype: 'Section',
    componentType: 'Testimonials',
    language: 'tsx'
  },
  Team: {
    canonicalPath: 'src/components/Team.tsx',
    description: "Choose when the user wants to showcase team members, leadership, or staff. Good for 'about the team', 'our experts', 'leadership', or 'meet the team' sections.",
    filetype: 'Section',
    componentType: 'Team',
    language: 'tsx'
  },
  Pricing: {
    canonicalPath: 'src/components/Pricing.tsx',
    description: "Choose when the user wants to display pricing information, plans, or packages. Good for 'plans', 'packages', 'subscriptions', or any price-related comparison sections.",
    filetype: 'Section',
    componentType: 'Pricing',
    language: 'tsx'
  },
  SocialProof: {
    canonicalPath: 'src/components/SocialProof.tsx',
    description: "Choose when the user wants to display trust indicators like logos, statistics, or achievements. Good for 'trusted by', 'as seen in', 'achievements', or sections showing company/client logos.",
    filetype: 'Section',
    componentType: 'SocialProof',
    language: 'tsx'
  },
  // Layout Components
  Nav: {
    canonicalPath: 'src/components/Nav.tsx',
    description: 'Default description for Nav',
    filetype: 'Layout',
    componentType: 'Nav',
    language: 'tsx'
  },
  Footer: {
    canonicalPath: 'src/components/Footer.tsx',
    description: 'Default description for Footer',
    filetype: 'Layout',
    componentType: 'Footer',
    language: 'tsx'
  },
  Sidebar: {
    canonicalPath: 'src/components/Sidebar.tsx',
    description: 'Default description for Sidebar',
    filetype: 'Layout',
    componentType: 'Sidebar',
    language: 'tsx'
  }
};

// Page file specifications
export const PAGE_SPEC_SEEDS = {
  IndexPage: {
    canonicalPath: 'src/pages/IndexPage.tsx',
    description: "Choose for the main landing page or homepage. This is the primary entry point of the website that showcases the most important content and sections. Good for 'home', 'landing', or 'main' page requests.",
    filetype: 'Page',
    componentType: 'IndexPage',
    language: 'tsx'
  },
  PricingPage: {
    canonicalPath: 'src/pages/PricingPage.tsx',
    description: "Choose for a dedicated pricing page that provides detailed information about different plans, packages, or service tiers. Good for 'pricing', 'plans', or 'packages' page requests.",
    filetype: 'Page',
    componentType: 'PricingPage',
    language: 'tsx'
  },
  NotFoundPage: {
    canonicalPath: 'src/pages/NotFoundPage.tsx',
    description: "Choose for the 404 error page that appears when users try to access non-existent pages. Should provide helpful navigation options and maintain brand consistency. Good for '404', 'error', or 'not found' page requests.",
    filetype: 'Page',
    componentType: 'NotFoundPage',
    language: 'tsx'
  },
  AboutPage: {
    canonicalPath: 'src/pages/AboutPage.tsx',
    description: "Choose for pages that tell the company or product story, mission, values, and team information. Good for 'about us', 'our story', 'company', or 'mission' page requests.",
    filetype: 'Page',
    componentType: 'AboutPage',
    language: 'tsx'
  },
  ContactPage: {
    canonicalPath: 'src/pages/ContactPage.tsx',
    description: "Choose for pages that provide contact information, contact forms, or other ways to get in touch. Good for 'contact us', 'reach out', 'get in touch', or 'support' page requests.",
    filetype: 'Page',
    componentType: 'ContactPage',
    language: 'tsx'
  },
  OtherPage: {
    canonicalPath: 'src/pages/OtherPage.tsx',
    description: "Choose for specialized pages that don't fit into other categories. This is a flexible template for custom pages like terms of service, privacy policy, careers, or other unique content pages.",
    filetype: 'Page',
    componentType: 'OtherPage',
    language: 'tsx'
  }
};

// Config file specifications
export const CONFIG_SPEC_SEEDS = {
  PackageJson: {
    canonicalPath: 'package.json',
    description: 'Default description for PackageJson',
    filetype: 'Config',
    componentType: 'PackageJson',
    language: 'json'
  },
  TsConfig: {
    canonicalPath: 'tsconfig.json',
    description: 'Default description for TsConfig',
    filetype: 'Config',
    componentType: 'TsConfig',
    language: 'json'
  },
  EslintConfig: {
    canonicalPath: '.eslintrc.json',
    description: 'Default description for EslintConfig',
    filetype: 'Config',
    componentType: 'EslintConfig',
    language: 'json'
  },
  ViteConfig: {
    canonicalPath: 'vite.config.js',
    description: 'Default description for ViteConfig',
    filetype: 'Config',
    componentType: 'ViteConfig',
    language: 'json'
  }
};

// Style file specifications
export const STYLE_SPEC_SEEDS = {
  IndexCss: {
    canonicalPath: 'src/index.css',
    description: 'Default description for IndexCss',
    filetype: 'Style',
    componentType: 'IndexCss',
    language: 'css'
  },
  AppCss: {
    canonicalPath: 'src/app.css',
    description: 'Default description for AppCss',
    filetype: 'Style',
    componentType: 'AppCss',
    language: 'css'
  },
  TailwindConfig: {
    canonicalPath: 'tailwind.config.ts',
    description: 'Default description for TailwindConfig',
    filetype: 'Style',
    componentType: 'TailwindConfig',
    language: 'json'
  }
};

// Helper to get all seed data for a component type
export function getFileSpecSeed(componentType: string) {
  return FILE_SPEC_SEEDS[componentType as keyof typeof FILE_SPEC_SEEDS] ||
         PAGE_SPEC_SEEDS[componentType as keyof typeof PAGE_SPEC_SEEDS] ||
         CONFIG_SPEC_SEEDS[componentType as keyof typeof CONFIG_SPEC_SEEDS] ||
         STYLE_SPEC_SEEDS[componentType as keyof typeof STYLE_SPEC_SEEDS] ||
         null;
}