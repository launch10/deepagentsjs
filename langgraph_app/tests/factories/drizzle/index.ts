import { 
  db, 
  websites, 
  pages, 
  fileSpecifications, 
  componentOverviews, 
  componentContentPlans,
  contentStrategies,
  projects, 
  accounts, 
  themes,
  themeLabels,
  themesToThemeLabels,
  templates,
  templateFiles,
  components,
  tasks,
  websiteFiles,
  eq,
  withTimestamps,
  withUpdatedAt
} from '@db';
import { PageTypeEnum } from '@types';
import { faker } from '@faker-js/faker';
import { reset } from "drizzle-seed";
import * as schema from "@db";
import { drizzle } from "drizzle-orm/postgres-js";

/**
 * Modern Drizzle-based factories with automated associations
 * These factories use Drizzle's insert methods directly and handle relationships
 */

// Helper type for factory overrides
type Override<T> = Partial<T>;

/**
 * Project Factory
 */
export const projectFactory = {
  build: (overrides: Override<typeof projects.$inferInsert> = {}) => (withTimestamps({
    name: faker.company.name(),
    threadId: faker.string.uuid(), // Projects need a thread ID
    ...overrides,
  })),

  async create(overrides: Override<typeof projects.$inferInsert> = {}) {
    // Auto-create account if not provided (projects require an account)
    let accountId = overrides.accountId;
    
    if (!accountId) {
      const account = await accountFactory.create();
      accountId = Number(account.id);
    }

    const [project] = await db.insert(projects)
      .values(this.build({ ...overrides, accountId }))
      .returning();
    return project;
  },

  async createMany(count: number, overrides: Override<typeof projects.$inferInsert> = {}) {
    // For multiple projects, use the same account if not provided
    let accountId = overrides.accountId;
    
    if (!accountId) {
      const account = await accountFactory.create();
      accountId = Number(account.id);
    }

    const values = Array(count).fill(null).map(() => 
      this.build({ ...overrides, accountId })
    );
    const results = await db.insert(projects)
      .values(values)
      .returning();
    return results;
  },

  async createWithAccount(projectOverrides: Override<typeof projects.$inferInsert> = {}, accountOverrides: Override<typeof accounts.$inferInsert> = {}) {
    const account = await accountFactory.create(accountOverrides);
    const project = await this.create({
      ...projectOverrides,
      accountId: Number(account.id),
    });
    return { project, account };
  }
};

/**
 * Account Factory
 */
export const accountFactory = {
  build: (overrides: Override<typeof accounts.$inferInsert> = {}) => ({
    name: faker.company.name(),
    ...overrides,
  }),

  async create(overrides: Override<typeof accounts.$inferInsert> = {}) {
    const [account] = await db.insert(accounts)
      .values(this.build(overrides))
      .returning();
    return account;
  },

  async createMany(count: number, overrides: Override<typeof accounts.$inferInsert> = {}) {
    const values = Array(count).fill(null).map(() => this.build(overrides));
    const results = await db.insert(accounts)
      .values(values)
      .returning();
    return results;
  }
};

/**
 * Website Factory with automatic project/account creation
 */
export const websiteFactory = {
  build: (overrides: Override<typeof websites.$inferInsert> = {}) => ({
    name: faker.company.name(),
    ...overrides,
  }),

  async create(overrides: Override<typeof websites.$inferInsert> = {}) {
    // Auto-create account first, then project if not provided
    let accountId = overrides.accountId;
    let projectId = overrides.projectId;

    // If we need to create a project, we need an account first
    if (!projectId) {
      // If no account provided either, create one
      if (!accountId) {
        const account = await accountFactory.create();
        accountId = Number(account.id);
      }
      // Now create project with the account
      const project = await projectFactory.create({ accountId });
      projectId = Number(project.id);
    } else if (!accountId) {
      // If project is provided but account isn't, just create account
      const account = await accountFactory.create();
      accountId = Number(account.id);
    }

    const [website] = await db.insert(websites)
      .values(this.build({ ...overrides, projectId, accountId }))
      .returning();

    return website;
  },

  async createMany(count: number, overrides: Override<typeof websites.$inferInsert> = {}) {
    // For multiple websites, create a single account/project if not provided
    let accountId = overrides.accountId;
    let projectId = overrides.projectId;

    // Create account first if needed
    if (!accountId) {
      const account = await accountFactory.create();
      accountId = Number(account.id);
    }

    // Then create project if needed
    if (!projectId) {
      const project = await projectFactory.create({ accountId });
      projectId = Number(project.id);
    }

    const values = Array(count).fill(null).map(() => 
      this.build({ ...overrides, projectId, accountId })
    );
    const results = await db.insert(websites)
      .values(values)
      .returning();
    return results;
  },

  async createWithAssociations() {
    // Create account first
    const account = await accountFactory.create();
    // Then create project with that account
    const project = await projectFactory.create({ accountId: Number(account.id) });
    // Finally create website with both
    const website = await this.create({
      projectId: Number(project.id),
      accountId: Number(account.id),
    });
    const contentStrategy = await contentStrategyFactory.create({ websiteId: Number(website.id) });

    return { website, project, account, contentStrategy };
  }
};

/**
 * Page Factory with automatic website creation
 */
export const pageFactory = {
  build: (overrides: Override<typeof pages.$inferInsert> = {}) => ({
    name: faker.lorem.words(2),
    pageType: 'IndexPage',
    path: `/${faker.helpers.slugify(faker.lorem.words(2))}`,
    ...overrides,
  }),

  async create(overrides: Override<typeof pages.$inferInsert> = {}) {
    // Auto-create website if not provided
    let websiteId = overrides.websiteId;
    
    if (!websiteId) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }

    const [page] = await db.insert(pages)
      .values(this.build({ ...overrides, websiteId }))
      .returning();
    return page;
  },

  async createMany(count: number, overrides: Override<typeof pages.$inferInsert> = {}) {
    // For multiple pages, use the same website if not provided
    let websiteId = overrides.websiteId;
    
    if (!websiteId) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }

    const values = Array(count).fill(null).map((_, i) => 
      this.build({ 
        ...overrides, 
        websiteId,
        name: `Page ${i + 1}`,
        path: `/page-${i + 1}`
      })
    );
    const results = await db.insert(pages)
      .values(values)
      .returning();
    return results;
  },

  async createWithWebsite(pageOverrides: Override<typeof pages.$inferInsert> = {}, websiteOverrides: Override<typeof websites.$inferInsert> = {}) {
    const website = await websiteFactory.create(websiteOverrides);
    const page = await this.create({
      ...pageOverrides,
      websiteId: Number(website.id),
    });
    return { page, website };
  }
};

/**
 * FileSpecification Factory with Seed Data
 */
import { FILE_SPEC_SEEDS, PAGE_SPEC_SEEDS, CONFIG_SPEC_SEEDS, STYLE_SPEC_SEEDS, getFileSpecSeed } from './seeds';

export const fileSpecFactory = {
  build: (overrides: Override<typeof fileSpecifications.$inferInsert> = {}) => {
    // If componentType is provided and exists in seeds, use seed data
    const componentType = overrides.componentType;
    const seedData = componentType ? getFileSpecSeed(componentType) : null;

    const base = {
      canonicalPath: `/src/components/${faker.helpers.slugify(faker.lorem.word())}.tsx`,
      componentType: faker.helpers.arrayElement(['Hero', 'Benefits', 'Features', 'CTA', 'Footer', 'Nav']),
      };

    // Merge in order: base -> seed data -> overrides
    return {
      ...base,
      ...(seedData || {}),
      ...overrides,
    };
  },

  async create(overrides: Override<typeof fileSpecifications.$inferInsert> = {}) {
    const [fileSpec] = await db.insert(fileSpecifications)
      .values(this.build(overrides))
      .returning();
    return fileSpec;
  },

  async createMany(count: number, overrides: Override<typeof fileSpecifications.$inferInsert> = {}) {
    const componentTypes = ['Hero', 'Benefits', 'Features', 'CTA', 'Footer', 'Nav'];
    const values = Array(count).fill(null).map((_, i) => {
      const componentType = componentTypes[i % componentTypes.length];
      return this.build({ 
        ...overrides,
        componentType,
        name: `${componentType} Component`,
        canonicalPath: `/src/components/${componentType}.tsx`
      });
    });
    const results = await db.insert(fileSpecifications)
      .values(values)
      .returning();
    return results;
  },

  async seed() {
    const componentTypes = Object.keys(FILE_SPEC_SEEDS);
    const specs = await Promise.all(
      componentTypes.map(type => 
        this.create({ componentType: type })
      )
    );
    return specs;
  },

  // Create all section components
  async createAllSections() {
    const sections = Object.keys(FILE_SPEC_SEEDS).filter(key => 
      FILE_SPEC_SEEDS[key as keyof typeof FILE_SPEC_SEEDS].filetype === 'Section'
    );
    const specs = await Promise.all(
      sections.map(type => 
        this.create({ componentType: type })
      )
    );
    return specs;
  },

  // Create all layout components  
  async createAllLayouts() {
    const layouts = ['Nav', 'Footer', 'Sidebar'];
    const specs = await Promise.all(
      layouts.map(type => 
        this.create({ componentType: type })
      )
    );
    return specs;
  },

  // Create all page specs
  async createAllPages() {
    const pages = Object.keys(PAGE_SPEC_SEEDS);
    const specs = await Promise.all(
      pages.map(type => 
        this.create({ componentType: type })
      )
    );
    return specs;
  },

  // Create all config files
  async createAllConfigs() {
    const configs = Object.keys(CONFIG_SPEC_SEEDS);
    const specs = await Promise.all(
      configs.map(type => 
        this.create({ componentType: type })
      )
    );
    return specs;
  },

  // Create all style files
  async createAllStyles() {
    const styles = Object.keys(STYLE_SPEC_SEEDS);
    const specs = await Promise.all(
      styles.map(type => 
        this.create({ componentType: type })
      )
    );
    return specs;
  },

  // Create a complete project file structure
  async createCompleteProjectStructure() {
    const [sections, layouts, pages, configs, styles] = await Promise.all([
      this.createAllSections(),
      this.createAllLayouts(),
      this.createAllPages(),
      this.createAllConfigs(),
      this.createAllStyles()
    ]);

    return {
      sections,
      layouts,
      pages,
      configs,
      styles
    };
  },

  // Find or create by component type
  async findOrCreateByType(componentType: string) {
    // First try to find existing
    const existing = await db
      .select()
      .from(fileSpecifications)
      .where(eq(fileSpecifications.componentType, componentType))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }

    // Create new with seed data if available
    return this.create({ componentType });
  }
};

/**
 * ComponentOverview Factory with relationships
 */
import { backgroundColorKey, SectionTypeEnum } from '@types';

const purposeMap: Record<SectionTypeEnum, string> = {
  [SectionTypeEnum.Hero]: 'Capture attention and communicate the core value proposition immediately',
  [SectionTypeEnum.Features]: 'Showcase key capabilities and functionality to demonstrate product value',
  [SectionTypeEnum.Benefits]: 'Translate features into meaningful outcomes for the user',
  [SectionTypeEnum.HowItWorks]: 'Explain the process or methodology in simple, digestible steps',
  [SectionTypeEnum.Testimonials]: 'Build trust through authentic customer success stories',
  [SectionTypeEnum.Pricing]: 'Present pricing options clearly to facilitate decision-making',
  [SectionTypeEnum.FAQ]: 'Address common concerns and objections proactively',
  [SectionTypeEnum.CTA]: 'Drive conversion with a compelling call to action',
  [SectionTypeEnum.SocialProof]: 'Establish credibility through numbers, logos, and achievements',
  [SectionTypeEnum.Team]: 'Humanize the brand by showcasing the people behind the product',
  [SectionTypeEnum.Custom]: 'Deliver specialized content unique to this particular use case'
};

const contextMap: Record<SectionTypeEnum, string> = {
  [SectionTypeEnum.Hero]: 'This is the first thing visitors see - it needs to immediately communicate value and encourage scrolling or action',
  [SectionTypeEnum.Features]: 'After grabbing attention with the hero, we need to show concrete capabilities that solve real problems',
  [SectionTypeEnum.Benefits]: 'Users need to understand not just what the product does, but how it improves their situation',
  [SectionTypeEnum.HowItWorks]: 'Reducing perceived complexity helps users feel confident they can successfully use the product',
  [SectionTypeEnum.Testimonials]: 'Real stories from real users provide social proof and overcome skepticism',
  [SectionTypeEnum.Pricing]: 'Clear pricing information respects the user\'s time and helps qualify leads',
  [SectionTypeEnum.FAQ]: 'Anticipating questions shows we understand our users and reduces support burden',
  [SectionTypeEnum.CTA]: 'A focused call to action at key moments drives conversion',
  [SectionTypeEnum.SocialProof]: 'Logos, numbers, and awards provide quick credibility signals',
  [SectionTypeEnum.Team]: 'Showing the team builds trust and connection with potential customers',
  [SectionTypeEnum.Custom]: 'This custom section addresses specific needs unique to our target audience'
};

const nameMap: Record<SectionTypeEnum, string> = {
  [SectionTypeEnum.Hero]: 'Hero Banner',
  [SectionTypeEnum.Features]: 'Key Features',
  [SectionTypeEnum.Benefits]: 'Why Choose Us',
  [SectionTypeEnum.HowItWorks]: 'How It Works',
  [SectionTypeEnum.Testimonials]: 'Customer Stories',
  [SectionTypeEnum.Pricing]: 'Pricing Plans',
  [SectionTypeEnum.FAQ]: 'Frequently Asked Questions',
  [SectionTypeEnum.CTA]: 'Get Started',
  [SectionTypeEnum.SocialProof]: 'Trusted By',
  [SectionTypeEnum.Team]: 'Meet Our Team',
  [SectionTypeEnum.Custom]: 'Custom Section'
};

export const componentOverviewFactory = {
  build: (overrides: Override<typeof componentOverviews.$inferInsert> = {}) => {
    const componentType = overrides.componentType || faker.helpers.arrayElement(Object.values(SectionTypeEnum));
    const name = nameMap[componentType as keyof typeof nameMap];
    const purpose = purposeMap[componentType as keyof typeof purposeMap];
    const context = contextMap[componentType as keyof typeof contextMap];
    const copy = faker.helpers.arrayElement([
      'Start your free trial today and transform how you work',
      'Join thousands of teams already using our platform',
      'Experience the difference with our 30-day money-back guarantee',
      'See why industry leaders choose our solution'
    ]);
    const backgroundColor = faker.helpers.arrayElement(backgroundColorKey);
    return {
      name,
      componentType,
      purpose,
      context,
      copy,
      backgroundColor,
        ...overrides,
    };
  },

  async create(overrides: Override<typeof componentOverviews.$inferInsert> = {}) {
    // Auto-create related entities if not provided
    let websiteId = overrides.websiteId;
    let pageId = overrides.pageId;
    let fileSpecificationId = overrides.fileSpecificationId;

    // Create website if not provided
    if (!websiteId) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }

    // Create page if not provided
    if (!pageId) {
      const page = await pageFactory.create({ websiteId });
      pageId = Number(page.id);
    }

    // Create or find fileSpec based on componentType
    const componentType = overrides.componentType || this.build().componentType;
    if (!fileSpecificationId) {
      const fileSpec = await fileSpecFactory.create({ componentType });
      fileSpecificationId = Number(fileSpec.id);
    }

    const [overview] = await db.insert(componentOverviews)
      .values(this.build({ 
        ...overrides, 
        websiteId, 
        pageId, 
        fileSpecificationId,
        componentType 
      }))
      .returning();
    return overview;
  },

  async createWithAllRelations(
    overviewOverrides: Override<typeof componentOverviews.$inferInsert> = {},
    websiteOverrides: Override<typeof websites.$inferInsert> = {},
    pageOverrides: Override<typeof pages.$inferInsert> = {},
    fileSpecOverrides: Override<typeof fileSpecifications.$inferInsert> = {}
  ) {
    // Create all related entities
    const website = await websiteFactory.create(websiteOverrides);
    const page = await pageFactory.create({
      ...pageOverrides,
      websiteId: Number(website.id),
    });
    
    const componentType = overviewOverrides.componentType || 'Hero';
    const fileSpec = await fileSpecFactory.create({
      ...fileSpecOverrides,
      componentType,
    });

    const overview = await this.create({
      ...overviewOverrides,
      websiteId: Number(website.id),
      pageId: Number(page.id),
      fileSpecificationId: Number(fileSpec.id),
      componentType,
    });

    return { overview, website, page, fileSpec };
  },

  async createMany(count: number, overrides: Override<typeof componentOverviews.$inferInsert> = {}) {
    // For multiple overviews, use the same website/page if not provided
    let websiteId = overrides.websiteId;
    let pageId = overrides.pageId;

    if (!websiteId) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }

    if (!pageId) {
      const page = await pageFactory.create({ websiteId });
      pageId = Number(page.id);
    }

    // Create file specs for different component types
    const fileSpecs = await fileSpecFactory.seed();
    
    const values = await Promise.all(
      Array(count).fill(null).map(async (_, i) => {
        const fileSpec = fileSpecs[i % fileSpecs.length];
        return this.build({ 
          ...overrides, 
          websiteId, 
          pageId,
          fileSpecificationId: Number(fileSpec.id),
          componentType: fileSpec.componentType,
        });
      })
    );

    const results = await db.insert(componentOverviews)
      .values(values)
      .returning();
    return results;
  }
};

/**
 * Content Strategy Factory
 */
export const contentStrategyFactory = {
  build: (overrides: Override<typeof contentStrategies.$inferInsert> = {}) => ({
    summary: faker.helpers.arrayElement([
      'DevMode is a software tool that allows users to see the code behind any visual interface',
      'A sales enablement platform focused on content management and sales coaching.',
      'A marketing automation suite for SMBs',
      'A team collaboration tool'
    ]),
    tone: faker.helpers.arrayElement([
      'Professional yet approachable',
      'Bold and innovative',
      'Friendly and conversational',
      'Authoritative and expert',
      'Casual and relatable'
    ]),
    coreEmotionalDriver: faker.helpers.arrayElement([
      'Fear of falling behind competitors',
      'Desire for success and growth',
      'Need for security and stability',
      'Want to save time and money',
      'Aspiration to be industry leader'
    ]),
    attentionGrabber: faker.helpers.arrayElement([
      'Transform Your Business Today',
      'The Future of Work Starts Here',
      'Unlock Your Full Potential',
      'Join the Digital Revolution',
      'Simplify Everything'
    ]),
    problemStatement: faker.helpers.arrayElement([
      'Manual processes are holding your team back',
      'Your competitors are moving faster',
      'Traditional methods no longer work',
      'Time is your most valuable asset',
      'Complexity is killing productivity'
    ]),
    emotionalBridge: faker.helpers.arrayElement([
      'Imagine automating everything in minutes',
      'Picture your team working at peak efficiency',
      'Envision doubling your productivity',
      'Think about all the time you could save',
      'Consider the possibilities of true automation'
    ]),
    productReveal: faker.helpers.arrayElement([
      'Our platform eliminates busywork forever',
      'We make the impossible possible',
      'Everything you need in one place',
      'The only solution you will ever need',
      'Built for teams like yours'
    ]),
    socialProof: faker.helpers.arrayElement([
      'Join industry leaders who trust us',
      'Trusted by Fortune 500 companies',
      'Over 10,000 happy customers',
      'Award-winning platform',
      'Recommended by experts worldwide'
    ]),
    urgencyHook: faker.helpers.arrayElement([
      'Limited spots for personalized onboarding',
      'Special pricing ends soon',
      'Join the waitlist before it is too late',
      'Early access available now',
      'Exclusive offer for new customers'
    ]),
    callToAction: faker.helpers.arrayElement([
      'Start Free Trial',
      'Get Started Today',
      'Book Your Demo',
      'Sign Up Now',
      'Claim Your Spot'
    ]),
    pageMood: faker.helpers.arrayElement([
      'Modern, trustworthy, innovative',
      'Clean, professional, efficient',
      'Bold, dynamic, forward-thinking',
      'Warm, welcoming, supportive',
      'Sleek, sophisticated, cutting-edge'
    ]),
    visualEvocation: faker.helpers.arrayElement([
      'Clean minimalist design with subtle animations',
      'Bold colors and striking imagery',
      'Soft gradients and smooth transitions',
      'High-contrast modern interface',
      'Playful illustrations and micro-interactions'
    ]),
    landingPageCopy: faker.lorem.paragraphs(3),
    ...overrides,
  }),

  async create(overrides: Override<typeof contentStrategies.$inferInsert> = {}) {
    // Auto-create website if websiteId is provided but not as a number
    let websiteId = overrides.websiteId;
    
    if (!websiteId && overrides.websiteId !== null) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }

    const [strategy] = await db.insert(contentStrategies)
      .values(this.build({ ...overrides, websiteId }))
      .returning();
    return strategy;
  },

  async createWithWebsite(
    strategyOverrides: Override<typeof contentStrategies.$inferInsert> = {},
    websiteOverrides: Override<typeof websites.$inferInsert> = {}
  ) {
    const website = await websiteFactory.create(websiteOverrides);
    const strategy = await this.create({
      ...strategyOverrides,
      websiteId: Number(website.id),
    });
    return { strategy, website };
  },

  // Create different strategy profiles
  async createB2BSaaS(websiteId?: number) {
    return this.create({
      tone: 'Professional yet approachable',
      coreEmotionalDriver: 'Fear of falling behind competitors',
      attentionGrabber: 'Transform Your Business Today',
      problemStatement: 'Manual processes are holding your team back',
      emotionalBridge: 'Imagine automating everything in minutes',
      productReveal: 'Our platform eliminates busywork forever',
      socialProof: 'Join industry leaders who trust us',
      urgencyHook: 'Limited spots for personalized onboarding',
      callToAction: 'Start Free Trial',
      pageMood: 'Modern, trustworthy, innovative',
      visualEvocation: 'Clean minimalist design with subtle animations',
      landingPageCopy: 'Transform your business with our cutting-edge SaaS platform. Automate workflows, increase productivity, and stay ahead of the competition.',
      websiteId
    });
  },

  async createEcommerce(websiteId?: number) {
    return this.create({
      tone: 'Friendly and conversational',
      coreEmotionalDriver: 'Desire for quality and value',
      attentionGrabber: 'Discover Amazing Products',
      problemStatement: 'Finding quality products at fair prices is hard',
      emotionalBridge: 'Imagine having everything you need delivered to your door',
      productReveal: 'Curated collections from trusted brands',
      socialProof: 'Over 1 million happy customers',
      urgencyHook: 'Limited stock - order now',
      callToAction: 'Shop Now',
      pageMood: 'Vibrant, trustworthy, exciting',
      visualEvocation: 'Bright product photography with clean layouts',
      landingPageCopy: 'Shop the best products from top brands. Fast shipping, easy returns, and unbeatable prices.',
      websiteId
    });
  }
};

/**
 * Component Content Plan Factory
 */
const COMPONENT_CONTENT_SEEDS = {
  Hero: {
    headline: 'Transform Your Business Today',
    subheadline: 'Join thousands of companies that have revolutionized their workflow',
    paragraphs: 'Our platform provides cutting-edge solutions that scale with your needs.',
    ctaText: 'Start Free Trial',
    visualConcept: 'Modern dashboard interface with analytics',
    layoutVariant: 'text-left-image-right',
    visualEmphasis: 'headline-focus',
    trustSignals: ['Trusted by Fortune 500', '99.9% Uptime', 'SOC 2 Certified'],
    suggestedComponents: ['Button', 'Card', 'Input'],
    layoutDescription: 'Two-column layout with text on the left and image on the right',
    layoutEmphasis: 'headline',
    visualStyleNotes: 'Clean, modern design with subtle gradients',
    responsivenessNotes: 'Stack vertically on mobile with image above text',
  },
  Benefits: {
    headline: 'Why Choose Our Platform',
    subheadline: 'Experience the benefits of modern technology',
    benefits: [
      {
        statement: 'Fast Performance',
        elaboration: 'Lightning-fast response times ensure productivity',
        visual: 'Zap icon',
      },
      {
        statement: 'Secure',
        elaboration: 'Enterprise-grade security protects your data',
        visual: 'Shield icon',
      },
      {
        statement: 'Scalable',
        elaboration: 'Grows seamlessly with your business needs',
        visual: 'TrendingUp arrow',
      },
    ],
    suggestedComponents: ['Card', 'Icon', 'Grid'],
    layoutDescription: 'Three-column grid layout with icon cards',
    visualStyleNotes: 'Icons with subtle background colors, clean typography',
  },
  CTA: {
    headline: 'Ready to Get Started?',
    supportingText: 'Join thousands of satisfied customers today',
    cta: {
      text: 'Start Free Trial',
      variant: 'primary',
      size: 'large'
    },
    supportingVisualOrTrustSignal: 'Limited time offer - 50% off first month',
    suggestedComponents: ['Button', 'Badge'],
    layoutDescription: 'Centered content with prominent call-to-action button',
    visualStyleNotes: 'High contrast section with gradient background',
  },
  Features: {
    headline: 'Powerful Features',
    subheadline: 'Everything you need to succeed',
    features: [
      {
        name: 'Analytics Dashboard',
        description: 'Real-time insights and reporting. Track performance metrics in real-time',
        visual: 'BarChart icon or dashboard screenshot',
      },
      {
        name: 'Team Collaboration',
        description: 'Work together seamlessly. Share and collaborate with your team',
        visual: 'Users icon or collaboration interface',
      },
      {
        name: 'Automation Tools',
        description: 'Automate repetitive tasks. Save hours every week with smart automation',
        visual: 'Cog icon or automation flow diagram',
      },
      {
        name: 'Custom Integrations',
        description: 'Connect with your favorite tools. Seamless integration with 100+ apps',
        visual: 'Plug icon or integration logos',
      },
    ],
    cta: 'Explore all features',
    suggestedComponents: ['Card', 'Image', 'Button', 'Grid'],
    layoutDescription: 'Two-column alternating layout with feature descriptions and visuals',
    visualStyleNotes: 'Feature screenshots or illustrations with descriptive text',
  },
  FAQ: {
    headline: 'Frequently Asked Questions',
    paragraphs: 'Find answers to common questions about our platform',
    qaPairs: [
      {
        question: 'How does pricing work?',
        answer: 'We offer flexible monthly and annual plans. All plans include core features with additional capabilities in higher tiers.',
      },
      {
        question: 'Is there a free trial?',
        answer: 'Yes, we offer a 14-day free trial with full access to all features. No credit card required.',
      },
      {
        question: 'Can I cancel anytime?',
        answer: 'Absolutely. You can cancel your subscription at any time with no cancellation fees.',
      },
      {
        question: 'Do you offer customer support?',
        answer: 'Yes, we provide 24/7 customer support via chat, email, and phone for all paid plans.',
      },
      {
        question: 'Is my data secure?',
        answer: 'We use bank-level encryption and are SOC 2 certified. Your data is always protected.',
      },
    ],
    suggestedComponents: ['Accordion', 'AccordionItem'],
    layoutDescription: 'Expandable accordion layout with questions and answers',
    visualStyleNotes: 'Clean, minimalist design with clear typography',
  },
  HowItWorks: {
    headline: 'How It Works',
    subheadline: 'Get started in 3 simple steps',
    steps: [
      {
        title: 'Sign Up',
        description: 'Create your free account in less than 60 seconds',
        visual: 'UserPlus icon',
      },
      {
        title: 'Configure',
        description: 'Set up your workspace and invite your team',
        visual: 'Settings icon',
      },
      {
        title: 'Launch',
        description: 'Start using the platform and see immediate results',
        visual: 'Rocket icon',
      },
    ],
    suggestedComponents: ['Steps', 'Card', 'Icon', 'Timeline'],
    layoutDescription: 'Step-by-step visual timeline or numbered cards',
    visualStyleNotes: 'Progressive flow with connecting lines or arrows',
  },
  Pricing: {
    headline: 'Choose Your Plan',
    subheadline: 'Transparent pricing that scales with your business',
    plans: [
      {
        name: 'Starter',
        price: '$29',
        billingFrequency: '/month',
        description: 'Perfect for small teams',
        features: ['5 users', '10GB storage', 'Basic support', 'Core features'],
        ctaText: 'Get Started',
        highlight: false,
      },
      {
        name: 'Professional',
        price: '$99',
        billingFrequency: '/month',
        description: 'For growing businesses',
        features: ['Unlimited users', '100GB storage', 'Priority support', 'Advanced features', 'API access'],
        ctaText: 'Get Started',
        highlight: true,
        badge: 'Most Popular',
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        billingFrequency: '',
        description: 'For large organizations',
        features: ['Unlimited everything', 'Dedicated support', 'Custom integrations', 'SLA guarantee', 'Training included'],
        ctaText: 'Contact Sales',
        highlight: false,
      },
    ],
    suggestedComponents: ['PricingCard', 'Badge', 'Button', 'CheckIcon'],
    layoutDescription: 'Three-column pricing cards with feature lists',
    visualStyleNotes: 'Highlighted recommended plan, clear pricing display',
  },
  SocialProof: {
    headline: 'Trusted by Industry Leaders',
    subheadline: 'Join over 10,000 companies using our platform',
    trustSignals: [
      {
        type: 'logo',
        name: 'Microsoft',
        visual: 'Microsoft logo',
      },
      {
        type: 'logo',
        name: 'Google',
        visual: 'Google logo',
      },
      {
        type: 'logo',
        name: 'Amazon',
        visual: 'Amazon logo',
      },
      {
        type: 'statistic',
        value: '99.9%',
        label: 'Uptime SLA',
      },
      {
        type: 'statistic',
        value: '10,000+',
        label: 'Happy Customers',
      },
      {
        type: 'statistic',
        value: '4.9/5',
        label: 'Average Rating',
      },
    ],
    suggestedComponents: ['Logo', 'Statistic', 'Grid'],
    layoutDescription: 'Logo grid with statistics below or alongside',
    visualStyleNotes: 'Grayscale logos, prominent statistics with labels',
  },
  Team: {
    headline: 'Meet Our Team',
    subheadline: 'The experts behind your success',
    teamMembers: [
      {
        name: 'Jane Smith',
        role: 'CEO & Founder',
        bio: 'Leading the vision with 15+ years of industry experience',
        image: 'Professional headshot',
        socialLinks: ['LinkedIn', 'Twitter'],
      },
      {
        name: 'John Doe',
        role: 'CTO',
        bio: 'Building cutting-edge technology solutions',
        image: 'Professional headshot',
        socialLinks: ['LinkedIn', 'GitHub'],
      },
      {
        name: 'Sarah Johnson',
        role: 'Head of Customer Success',
        bio: 'Ensuring every customer achieves their goals',
        image: 'Professional headshot',
        socialLinks: ['LinkedIn'],
      },
    ],
    suggestedComponents: ['TeamCard', 'Avatar', 'SocialLinks', 'Grid'],
    layoutDescription: 'Grid layout with team member cards including photos and bios',
    visualStyleNotes: 'Professional photos, clean card design with hover effects',
  },
  Testimonials: {
    headline: 'What Our Customers Say',
    subheadline: 'Real stories from real users',
    testimonials: [
      {
        quote: 'This platform transformed how we work. We have saved countless hours and improved productivity by 40%.',
        author: 'Michael Chen',
        role: 'VP of Operations',
        company: 'TechCorp',
        image: 'Customer headshot or company logo',
        rating: 5,
      },
      {
        quote: 'The best investment we have made. The ROI was evident within the first month.',
        author: 'Lisa Anderson',
        role: 'CEO',
        company: 'StartupXYZ',
        image: 'Customer headshot or company logo',
        rating: 5,
      },
      {
        quote: 'Outstanding support and an incredibly intuitive platform. Highly recommended!',
        author: 'David Williams',
        role: 'Product Manager',
        company: 'GlobalTech',
        image: 'Customer headshot or company logo',
        rating: 5,
      },
    ],
    suggestedComponents: ['TestimonialCard', 'Rating', 'Avatar', 'Carousel'],
    layoutDescription: 'Carousel or grid of testimonial cards with quotes and attribution',
    visualStyleNotes: 'Quote marks, star ratings, customer photos or logos',
  },
  Custom: {
    headline: 'Custom Section',
    subheadline: 'Tailored content for your specific needs',
    content: 'This section can be customized to include any type of content that does not fit into the standard categories.',
    suggestedComponents: ['Custom'],
    layoutDescription: 'Flexible layout based on specific requirements',
    visualStyleNotes: 'Styling to match the overall site theme',
  },
};

export const componentContentPlanFactory = {
  build: (overrides: Override<typeof componentContentPlans.$inferInsert> = {}) => {
    const allComponentTypes = Object.keys(COMPONENT_CONTENT_SEEDS);
    const componentType = overrides.componentType || faker.helpers.arrayElement(allComponentTypes);
    const seedData = COMPONENT_CONTENT_SEEDS[componentType as keyof typeof COMPONENT_CONTENT_SEEDS] || {};
    
    return {
      componentType,
      data: seedData,
        ...overrides,
    };
  },

  async create(overrides: Override<typeof componentContentPlans.$inferInsert> = {}) {
    // Auto-create component overview if not provided
    let componentOverviewId = overrides.componentOverviewId;
    
    if (!componentOverviewId) {
      const overview = await componentOverviewFactory.create({ 
        componentType: overrides.componentType 
      });
      componentOverviewId = Number(overview.id);
    }

    const [plan] = await db.insert(componentContentPlans)
      .values(this.build({ ...overrides, componentOverviewId }))
      .returning();
    return plan;
  },

  async createWithOverview(
    planOverrides: Override<typeof componentContentPlans.$inferInsert> = {},
    overviewOverrides: Override<typeof componentOverviews.$inferInsert> = {}
  ) {
    const componentType = planOverrides.componentType || overviewOverrides.componentType || 'Hero';
    const overview = await componentOverviewFactory.create({
      ...overviewOverrides,
      componentType,
    });
    
    const plan = await this.create({
      ...planOverrides,
      componentOverviewId: Number(overview.id),
      componentType,
    });
    
    return { plan, overview };
  },

  async createFullPageContentPlans(pageId: number, websiteId: number, componentTypes?: string[]) {
    // Default to a standard landing page structure if no types specified
    const types = componentTypes || ['Hero', 'Benefits', 'Features', 'HowItWorks', 'Testimonials', 'Pricing', 'FAQ', 'CTA'];
    
    const plans = await Promise.all(
      types.map(async (type) => {
        const overview = await componentOverviewFactory.create({
          componentType: type,
          pageId,
          websiteId,
        });
        
        return this.create({
          componentOverviewId: Number(overview.id),
          componentType: type,
        });
      })
    );
    
    return plans;
  },

  // Helper methods for specific component types
  async createHeroPlan(overviewId?: number) {
    return this.create({
      componentOverviewId: overviewId,
      componentType: 'Hero',
    });
  },

  async createFeaturesPlan(overviewId?: number) {
    return this.create({
      componentOverviewId: overviewId,
      componentType: 'Features',
    });
  },

  async createPricingPlan(overviewId?: number) {
    return this.create({
      componentOverviewId: overviewId,
      componentType: 'Pricing',
    });
  },

  async createTestimonialsPlan(overviewId?: number) {
    return this.create({
      componentOverviewId: overviewId,
      componentType: 'Testimonials',
    });
  },

  async createFAQPlan(overviewId?: number) {
    return this.create({
      componentOverviewId: overviewId,
      componentType: 'FAQ',
    });
  },

  // Create plans for different page types
  async createLandingPagePlans(pageId: number, websiteId: number) {
    return this.createFullPageContentPlans(pageId, websiteId, 
      ['Hero', 'Benefits', 'Features', 'SocialProof', 'Testimonials', 'CTA']
    );
  },

  async createPricingPagePlans(pageId: number, websiteId: number) {
    return this.createFullPageContentPlans(pageId, websiteId,
      ['Hero', 'Pricing', 'FAQ', 'Testimonials', 'CTA']
    );
  },

  async createAboutPagePlans(pageId: number, websiteId: number) {
    return this.createFullPageContentPlans(pageId, websiteId,
      ['Hero', 'Team', 'Benefits', 'Testimonials', 'CTA']
    );
  }
};

/**
 * Theme Factory
 */
export const themeFactory = {
  build: (overrides: Override<typeof themes.$inferInsert> = {}) => ({
    name: faker.helpers.arrayElement(['Modern', 'Classic', 'Minimal', 'Bold', 'Elegant']),
    colors: {
      primary: faker.color.rgb(),
      secondary: faker.color.rgb(),
      accent: faker.color.rgb(),
      background: faker.color.rgb(),
      foreground: faker.color.rgb(),
    },
    theme: {
      borderRadius: faker.helpers.arrayElement(['none', 'sm', 'md', 'lg', 'full']),
      fontFamily: faker.helpers.arrayElement(['sans-serif', 'serif', 'mono']),
      fontSize: faker.helpers.arrayElement(['sm', 'base', 'lg', 'xl']),
    },
    ...overrides,
  }),

  async create(overrides: Override<typeof themes.$inferInsert> & { labels?: string[] } = {}) {
    // Extract labels from overrides if provided
    const { labels, ...themeData } = overrides;
    
    // Create the theme
    const [theme] = await db.insert(themes)
      .values(this.build(themeData))
      .returning();
    
    // If labels are provided, create the relationships
    if (labels && labels.length > 0) {
      // First ensure the labels exist
      const labelRecords = await Promise.all(
        labels.map(async (labelName) => {
          // Try to find existing label
          const [existingLabel] = await db
            .select()
            .from(themeLabels)
            .where(eq(themeLabels.name, labelName))
            .limit(1);
          
          if (existingLabel) {
            return existingLabel;
          }
          
          // Create new label if it doesn't exist
          const [newLabel] = await db.insert(themeLabels)
            .values({ name: labelName })
            .returning();
          return newLabel;
        })
      );
      
      // Create the many-to-many relationships
      if (labelRecords.length > 0) {
        await db.insert(themesToThemeLabels)
          .values(
            labelRecords.map(label => ({
              themeId: Number(theme.id),
              themeLabelId: Number(label.id),
            }))
          );
      }
      
      // Return theme with labels attached
      return { ...theme, labels: labelRecords.map(l => l.name) };
    }
    
    return theme;
  },

  async createStandardThemes() {
    const themes = await Promise.all([
      this.create({
        name: 'Modern',
        colors: {
          primary: '#3B82F6',
          secondary: '#10B981',
          accent: '#F59E0B',
          background: '#FFFFFF',
          foreground: '#111827',
        },
      }),
      this.create({
        name: 'Dark',
        colors: {
          primary: '#8B5CF6',
          secondary: '#EC4899',
          accent: '#14B8A6',
          background: '#111827',
          foreground: '#F9FAFB',
        },
      }),
      this.create({
        name: 'Minimal',
        colors: {
          primary: '#000000',
          secondary: '#6B7280',
          accent: '#DC2626',
          background: '#FFFFFF',
          foreground: '#000000',
        },
      }),
    ]);
    return themes;
  }
};

/**
 * Template Factory
 */
export const templateFactory = {
  build: (overrides: Override<typeof templates.$inferInsert> = {}) => ({
    name: overrides.name || 'default',
    ...overrides,
  }),

  async create(overrides: Override<typeof templates.$inferInsert> = {}) {
    const [template] = await db.insert(templates)
      .values(this.build(overrides))
      .returning();
    return template;
  },

  async seed() {
    // Create the default template
    const template = await this.create({
      name: 'default'
    });

    // Create all template files for this template
    await templateFilesFactory.createAllForTemplate(Number(template.id));
    
    return template;
  },

  async createWithFiles(
    templateOverrides: Override<typeof templates.$inferInsert> = {},
    fileCount?: number
  ) {
    const template = await this.create(templateOverrides);
    
    if (fileCount) {
      await templateFilesFactory.createMany(fileCount, { templateId: Number(template.id) });
    } else {
      await templateFilesFactory.createAllForTemplate(Number(template.id));
    }
    
    return template;
  }
};

/**
 * Template Files Factory with JSON seed data
 */
import templateFilesData from './templates/template_files.json';

export const templateFilesFactory = {
  build: (overrides: Override<typeof templateFiles.$inferInsert> = {}, seedIndex?: number) => {
    // If seedIndex is provided, use that specific seed data
    const seedData = seedIndex !== undefined ? templateFilesData[seedIndex] : null;
    
    const base = {
      path: faker.system.filePath(),
      content: faker.lorem.paragraph(),
      };

    if (seedData) {
      return {
        ...base,
        path: seedData.path,
        content: typeof seedData.content === 'object' 
          ? JSON.stringify(seedData.content, null, 2) 
          : seedData.content,
        shasum: seedData.shasum || null,
        fileSpecificationId: seedData.file_specification_id || null,
        ...overrides,
      };
    }

    return {
      ...base,
      ...overrides,
    };
  },

  async create(overrides: Override<typeof templateFiles.$inferInsert> = {}) {
    // Auto-create template if not provided
    let templateId = overrides.templateId;
    
    if (!templateId) {
      const template = await templateFactory.create();
      templateId = Number(template.id);
    }

    const [file] = await db.insert(templateFiles)
      .values(this.build({ ...overrides, templateId }))
      .returning();
    return file;
  },

  async createFromSeed(seedIndex: number, overrides: Override<typeof templateFiles.$inferInsert> = {}) {
    // Auto-create template if not provided
    let templateId = overrides.templateId;
    
    if (!templateId) {
      const template = await templateFactory.create();
      templateId = Number(template.id);
    }

    const [file] = await db.insert(templateFiles)
      .values(this.build({ ...overrides, templateId }, seedIndex))
      .returning();
    return file;
  },

  async createMany(count: number, overrides: Override<typeof templateFiles.$inferInsert> = {}) {
    // Auto-create template if not provided
    let templateId = overrides.templateId;
    
    if (!templateId) {
      const template = await templateFactory.create();
      templateId = Number(template.id);
    }

    // Use seed data for as many files as we have, then generate random ones
    const values = Array(count).fill(null).map((_, i) => {
      if (i < templateFilesData.length) {
        return this.build({ ...overrides, templateId }, i);
      }
      return this.build({ ...overrides, templateId });
    });

    const results = await db.insert(templateFiles)
      .values(values)
      .returning();
    return results;
  },

  async createAllForTemplate(templateId: number) {
    // Create all 70 template files from the JSON seed data
    const values = templateFilesData.map((seedFile: any, index: number) => {
      return {
        templateId,
        path: seedFile.path,
        content: typeof seedFile.content === 'object' 
          ? JSON.stringify(seedFile.content, null, 2) 
          : seedFile.content,
        shasum: seedFile.shasum || null,
        fileSpecificationId: seedFile.file_specification_id || null,
          };
    });

    const results = await db.insert(templateFiles)
      .values(values)
      .returning();
    return results;
  },

  async createCoreFiles(templateId: number) {
    // Create only the most essential files
    const coreFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'src/App.tsx',
      'src/main.tsx',
      'src/index.css',
      'index.html'
    ];

    const values = templateFilesData
      .filter((file: any) => coreFiles.includes(file.path))
      .map((seedFile: any) => ({
        templateId,
        path: seedFile.path,
        content: typeof seedFile.content === 'object' 
          ? JSON.stringify(seedFile.content, null, 2) 
          : seedFile.content,
        shasum: seedFile.shasum || null,
        fileSpecificationId: seedFile.file_specification_id || null,
          }));

    const results = await db.insert(templateFiles)
      .values(values)
      .returning();
    return results;
  }
};

/**
 * Component Factory
 */
export const componentFactory = {
  build: (overrides: Override<typeof components.$inferInsert> = {}) => ({
    name: faker.lorem.words(2),
    path: `/src/components/${faker.helpers.slugify(faker.lorem.word())}.tsx`,
    componentType: faker.helpers.arrayElement(['Hero', 'Benefits', 'Features', 'CTA', 'Footer', 'Nav']),
    ...overrides,
  }),

  async create(overrides: Override<typeof components.$inferInsert> = {}) {
    // Auto-create dependencies if not provided
    let websiteId = overrides.websiteId;
    let pageId = overrides.pageId;
    let fileSpecificationId = overrides.fileSpecificationId;
    
    // Create website if needed
    if (!websiteId) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }
    
    // Create page if needed
    if (!pageId) {
      const page = await pageFactory.create({ websiteId });
      pageId = Number(page.id);
    }
    
    // Create file specification if needed
    if (!fileSpecificationId) {
      const componentType = overrides.componentType || this.build().componentType;
      const fileSpec = await fileSpecFactory.create({ componentType });
      fileSpecificationId = Number(fileSpec.id);
    }

    const [component] = await db.insert(components)
      .values(this.build({ ...overrides, websiteId, pageId, fileSpecificationId }))
      .returning();
    return component;
  },

  async createWithContentPlan(
    componentOverrides: Override<typeof components.$inferInsert> = {},
    contentPlanOverrides: Override<typeof componentContentPlans.$inferInsert> = {}
  ) {
    // First create the content plan
    const contentPlan = await componentContentPlanFactory.create(contentPlanOverrides);
    
    // Then create the component linked to it
    const component = await this.create({
      ...componentOverrides,
      componentContentPlanId: Number(contentPlan.id),
      componentType: contentPlan.componentType,
    });
    
    return { component, contentPlan };
  },

  async createMany(count: number, overrides: Override<typeof components.$inferInsert> = {}) {
    // Create shared dependencies
    let websiteId = overrides.websiteId;
    let pageId = overrides.pageId;
    
    if (!websiteId) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }
    
    if (!pageId) {
      const page = await pageFactory.create({ websiteId });
      pageId = Number(page.id);
    }

    const componentTypes = ['Hero', 'Benefits', 'Features', 'CTA', 'Footer', 'Nav'];
    const values = await Promise.all(
      Array(count).fill(null).map(async (_, i) => {
        const componentType = componentTypes[i % componentTypes.length];
        const fileSpec = await fileSpecFactory.create({ componentType });
        return this.build({ 
          ...overrides,
          websiteId,
          pageId,
          fileSpecificationId: Number(fileSpec.id),
          componentType,
          name: `${componentType} Component ${i + 1}`,
          path: `/src/components/${componentType}${i + 1}.tsx`
        });
      })
    );

    const results = await db.insert(components)
      .values(values)
      .returning();
    return results;
  }
};

/**
 * Task Factory (for code tasks)
 */
export const taskFactory = {
  build: (overrides: Override<typeof tasks.$inferInsert> = {}) => ({
    type: overrides.type || 'CodeTask',
    subtype: overrides.subtype || faker.helpers.arrayElement(['create', 'update', 'refactor', 'fix']),
    title: overrides.title || faker.lorem.sentence(),
    instructions: faker.lorem.paragraph(),
    status: overrides.status || 'pending',
    action: faker.helpers.arrayElement(['CREATE_COMPONENT', 'UPDATE_COMPONENT', 'CREATE_PAGE', 'UPDATE_PAGE']),
    results: {},
    ...overrides,
  }),

  async create(overrides: Override<typeof tasks.$inferInsert> = {}) {
    // Auto-create project if not provided
    let projectId = overrides.projectId;
    let websiteId = overrides.websiteId;
    let fileSpecificationId = overrides.fileSpecificationId;
    
    if (!projectId) {
      const project = await projectFactory.create();
      projectId = Number(project.id);
    }

    if (!websiteId) {
      const website = await websiteFactory.create({ projectId });
      websiteId = Number(website.id);
    }

    if (!fileSpecificationId) {
      const fileSpec = await fileSpecFactory.create();
      fileSpecificationId = Number(fileSpec.id);
    }

    const [task] = await db.insert(tasks)
      .values(this.build({ ...overrides, projectId, websiteId, fileSpecificationId }))
      .returning();
    return task;
  },

  async createCodeTask(overrides: Override<typeof tasks.$inferInsert> = {}) {
    return this.create({
      type: 'CodeTask',
      subtype: 'create',
      status: 'pending',
      ...overrides,
    });
  },

  async createWithComponent(
    taskOverrides: Override<typeof tasks.$inferInsert> = {},
    componentOverrides: Override<typeof components.$inferInsert> = {}
  ) {
    const component = await componentFactory.create(componentOverrides);
    const task = await this.create({
      ...taskOverrides,
      componentId: Number(component.id),
      title: taskOverrides.title || `Update ${component.name}`,
      action: 'update_component',
    });
    return { task, component };
  },

  async createWithFileSpec(
    taskOverrides: Override<typeof tasks.$inferInsert> = {},
    fileSpecOverrides: Override<typeof fileSpecifications.$inferInsert> = {}
  ) {
    const fileSpec = await fileSpecFactory.create(fileSpecOverrides);
    const task = await this.create({
      ...taskOverrides,
      fileSpecificationId: Number(fileSpec.id),
      title: taskOverrides.title || `Create ${fileSpec.componentType} component`,
      action: 'create_component',
    });
    return { task, fileSpec };
  },

  async createBatch(types: string[], projectId?: number) {
    // Create project if not provided
    if (!projectId) {
      const project = await projectFactory.create();
      projectId = Number(project.id);
    }

    const tasks = await Promise.all(
      types.map(type => 
        this.create({
          projectId,
          type: 'CodeTask',
          subtype: type,
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} task`,
          status: 'pending',
        })
      )
    );
    return tasks;
  },

  async createMany(count: number, overrides: Override<typeof tasks.$inferInsert> = {}) {
    let projectId = overrides.projectId;
    
    if (!projectId) {
      const project = await projectFactory.create();
      projectId = Number(project.id);
    }

    const values = Array(count).fill(null).map((_, i) => 
      this.build({ 
        ...overrides,
        projectId,
        title: `Task ${i + 1}`,
        status: i === 0 ? 'in_progress' : i < 3 ? 'pending' : 'completed',
      })
    );

    const results = await db.insert(tasks)
      .values(values)
      .returning();
    return results;
  }
};

/**
 * CreateComponentCodeTask Factory - Creates code tasks for component creation with full hierarchy
 */
export const createComponentCodeTaskFactory = {
  // Available component types that match our system
  componentTypes: ['Hero', 'Benefits', 'Features', 'CTA', 'FAQ', 'HowItWorks', 
                   'Pricing', 'SocialProof', 'Team', 'Testimonials', 'Footer', 
                   'Nav'],

  build: (overrides: Override<typeof tasks.$inferInsert> = {}) => ({
    type: 'CodeTask',
    subtype: 'create',
    title: overrides.title || faker.lorem.sentence(),
    instructions: overrides.instructions || faker.lorem.paragraph(),
    status: 'pending',
    action: 'CREATE_COMPONENT',
    results: {},
    ...overrides,
  }),

  async createAllSections(overrides: Override<typeof tasks.$inferInsert> = {}) {
    const sections = Object.keys(FILE_SPEC_SEEDS).filter(key => 
      FILE_SPEC_SEEDS[key as keyof typeof FILE_SPEC_SEEDS].filetype === 'Section'
    );
    const project = await projectFactory.create();
    const projectId = Number(project.id);
    const website = await websiteFactory.create({ projectId });
    const websiteId = Number(website.id);
    const page = await pageFactory.create({ websiteId, pageType: PageTypeEnum.IndexPage });
    const pageId = Number(page.id);

    const createdTasks = await Promise.all(
      sections.map(section => 
        this.create({
          ...overrides,
          projectId,
          websiteId,
          pageId,
          componentType: section as ComponentTypeEnum,
        })
      )
    )
    const tasks = createdTasks.map(data => data.task);
    
    return {
      tasks,
      website,
      project,
      page,
    };
  },

  async create(overrides: Override<typeof tasks.$inferInsert> = {}) {
    // Select a component type
    const componentType = overrides.componentType || 
      faker.helpers.arrayElement(this.componentTypes);
    
    // Auto-create project and website if not provided
    let projectId = overrides.projectId;
    let websiteId = overrides.websiteId;
    let pageId = overrides.pageId;
    let project, website;
    
    if (!projectId) {
      project = await projectFactory.create();
      projectId = Number(project.id);
    } else {
      // Get the project if we have the ID
      [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    }

    if (!websiteId) {
      website = await websiteFactory.create({ projectId });
      websiteId = Number(website.id);
    } else {
      // Get the website if we have the ID
      [website] = await db.select().from(websites).where(eq(websites.id, websiteId)).limit(1);
    }

    // Create page if not provided
    let page;
    if (!pageId) {
      page = await pageFactory.create({ websiteId });
      pageId = Number(page.id);
    }

    // Create the component overview (plan)
    // Convert componentType to TitleCase and handle special cases
    const titleCaseMap: Record<string, string> = {
      'FAQ': 'Faq',
      'CTA': 'Cta',
      'HowItWorks': 'HowItWorks',
      'SocialProof': 'SocialProof'
    };
    const titleCasedName = titleCaseMap[componentType] || 
      (componentType.charAt(0).toUpperCase() + componentType.slice(1).toLowerCase());
    
    const componentOverview = await componentOverviewFactory.create({
      websiteId,
      name: `${titleCasedName}Banner`,
      purpose: `Display ${componentType.toLowerCase()} content`,
      componentType,
    });

    // Create the component content plan
    const componentContentPlan = await componentContentPlanFactory.create({
      componentType,
      componentOverviewId: Number(componentOverview.id),
    });

    // Create the component itself
    const component = await componentFactory.create({
      websiteId,
      pageId,
      name: componentType,
      componentType,
      componentPlanId: Number(componentOverview.id),
      componentContentPlanId: Number(componentContentPlan.id),
    });

    // Update the componentOverview with the componentId
    await db.update(componentOverviews)
      .set({ componentId: Number(component.id) })
      .where(eq(componentOverviews.id, componentOverview.id));

    // Fetch the updated componentOverview
    const [updatedComponentOverview] = await db
      .select()
      .from(componentOverviews)
      .where(eq(componentOverviews.id, componentOverview.id));

    // Build and create the task
    const taskData = this.build({
      ...overrides,
      componentType,
      title: overrides.title || `Create ${componentType} component`,
    });

    const [task] = await db.insert(tasks)
      .values({
        ...taskData,
        projectId,
        websiteId,
        componentId: Number(component.id),
        componentOverviewId: Number(componentOverview.id),
        fileSpecificationId: component.fileSpecificationId,
      })
      .returning();

    return {
      task,
      component,
      componentOverview: updatedComponentOverview,
      componentContentPlan,
      page,
      website,
      project,
    };
  },

  async createBatch(componentTypes?: string[], overrides: Override<typeof tasks.$inferInsert> = {}) {
    const types = componentTypes || this.componentTypes.slice(0, 5);
    
    // Create shared project and website
    const project = await projectFactory.create();
    const website = await websiteFactory.create({ projectId: Number(project.id) });
    
    const results = await Promise.all(
      types.map(async componentType => {
        const result = await this.create({
          ...overrides,
          projectId: Number(project.id),
          websiteId: Number(website.id),
          componentType,
        });
        return result.task;
      })
    );
    
    return results;
  },

  async createWithMinimalDeps(componentType?: string, overrides: Override<typeof tasks.$inferInsert> = {}) {
    const selectedType = componentType || faker.helpers.arrayElement(this.componentTypes);
    
    // Create minimal dependencies (just project and website)
    const project = await projectFactory.create();
    const website = await websiteFactory.create({ projectId: Number(project.id) });
    
    return this.create({
      ...overrides,
      projectId: Number(project.id),
      websiteId: Number(website.id),
      componentType: selectedType,
    });
  },
};

/**
 * CodeTask Factory - Generic code tasks (for backwards compatibility)
 */
export const codeTaskFactory = {
  // Available component types that match our system
  componentTypes: ['Hero', 'Benefits', 'Features', 'CTA', 'FAQ', 'HowItWorks', 
                   'Pricing', 'SocialProof', 'Team', 'Testimonials', 'Footer', 
                   'Nav'],

  build: (overrides: Override<typeof tasks.$inferInsert> = {}) => {
    const subtype = overrides.subtype || 'create';
    
    return {
      type: 'CodeTask',
      subtype,
      title: overrides.title || faker.lorem.sentence(),
      instructions: overrides.instructions || faker.lorem.paragraph(),
      status: 'pending',
      action: subtype === 'create' ? 'CREATE_COMPONENT' : 'UPDATE_COMPONENT',
      results: {},
        ...overrides,
    };
  },

  async create(overrides: Override<typeof tasks.$inferInsert> = {}) {
    // Select a component type
    const componentType = overrides.componentType || 
      faker.helpers.arrayElement(this.componentTypes);
    
    // Auto-create project and website if not provided
    let projectId = overrides.projectId;
    let websiteId = overrides.websiteId;
    const componentId = overrides.componentId;
    
    if (!projectId) {
      const project = await projectFactory.create();
      projectId = Number(project.id);
    }

    if (!websiteId) {
      const website = await websiteFactory.create({ projectId });
      websiteId = Number(website.id);
    }

    let componentOverviewId = overrides.componentOverviewId;
    if (!componentOverviewId) {
      const componentOverview = await componentOverviewFactory.create({
        websiteId,
        componentType,
      });
      componentOverviewId = Number(componentOverview.id);
    }
    const fileSpec = await db.select().from(fileSpecifications).where(eq(fileSpecifications.componentType, componentType)).execute();
    const fileSpecificationId = fileSpec[0].id;
    if (!fileSpecificationId) {
      throw new Error('fileSpecification is required');
    }

    if (!overrides.websiteFileId) {
      const websiteFile = await websiteFilesFactory.create({
        websiteId,
        fileSpecificationId,
      });
      overrides.websiteFileId = Number(websiteFile.id);
    }

    // Build and create the task
    const taskData = this.build({
      ...overrides,
      title: overrides.title || `${overrides.subtype === 'create' || !overrides.subtype ? 'Create' : 'Update'} ${componentType} component`,
    });
    const [task] = await db.insert(tasks)
      .values({
        ...taskData,
        projectId,
        websiteId,
        componentOverviewId,
        fileSpecificationId
      })
      .returning();
    return task;
  },


  async createWithFullStack(componentType?: string, overrides: Override<typeof tasks.$inferInsert> = {}) {
    const selectedType = componentType || faker.helpers.arrayElement(this.componentTypes);
    
    // Create the full stack of dependencies
    const project = await projectFactory.create();
    const website = await websiteFactory.create({ projectId: Number(project.id) });
    const page = await pageFactory.create({ websiteId: Number(website.id) });
    
    // Create component with content plan
    const { component, contentPlan } = await componentFactory.createWithContentPlan(
      {
        websiteId: Number(website.id),
        pageId: Number(page.id),
        name: selectedType,
        componentType: selectedType,
      },
      { componentType: selectedType }
    );
    
    // Create the task referencing the component
    const task = await this.create({
      ...overrides,
      projectId: Number(project.id),
      websiteId: Number(website.id),
      componentId: Number(component.id),
      componentType: selectedType,
    });
    
    return {
      task,
      component,
      contentPlan,
      page,
      website,
      project,
    };
  },

  async createBatch(componentTypes?: string[], overrides: Override<typeof tasks.$inferInsert> = {}) {
    const types = componentTypes || this.componentTypes.slice(0, 5);
    
    // Create shared project and website
    const project = await projectFactory.create();
    const website = await websiteFactory.create({ projectId: Number(project.id) });
    const page = await pageFactory.create({ websiteId: Number(website.id) });
    
    const tasks = await Promise.all(
      types.map(async componentType => {
        // Create component for each task
        const component = await componentFactory.create({
          websiteId: Number(website.id),
          pageId: Number(page.id),
          name: componentType,
          componentType,
        });
        
        return this.create({
          ...overrides,
          projectId: Number(project.id),
          websiteId: Number(website.id),
          componentId: Number(component.id),
          componentType,
        });
      })
    );
    return tasks;
  },
};

/**
 * Website Files Factory
 */
export const websiteFilesFactory = {
  build: (overrides: Override<typeof websiteFiles.$inferInsert> = {}) => ({
    path: overrides.path || faker.system.filePath(),
    content: overrides.content || faker.lorem.paragraphs(3),
    shasum: faker.git.commitSha(),
    ...overrides,
  }),

  async create(overrides: Override<typeof websiteFiles.$inferInsert> = {}) {
    // Auto-create website if not provided
    let websiteId = overrides.websiteId;
    
    if (!websiteId) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }

    const [file] = await db.insert(websiteFiles)
      .values(this.build({ ...overrides, websiteId }))
      .returning();
    return file;
  },

  async createFromTemplate(templateFileId: number, websiteId?: number) {
    // Get the template file
    const [templateFile] = await db.select()
      .from(templateFiles)
      .where(eq(templateFiles.id, templateFileId))
      .limit(1);
    
    if (!templateFile) {
      throw new Error(`Template file ${templateFileId} not found`);
    }

    // Create website if not provided
    if (!websiteId) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }

    const [file] = await db.insert(websiteFiles)
      .values({
        websiteId,
        path: templateFile.path,
        content: templateFile.content,
        shasum: templateFile.shasum,
        fileSpecificationId: templateFile.fileSpecificationId,
          })
      .returning();
    return file;
  },

  async createProjectFiles(websiteId?: number) {
    // Create website if not provided
    if (!websiteId) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }

    const standardFiles = [
      { path: 'package.json', content: '{"name": "test-app", "version": "1.0.0"}' },
      { path: 'tsconfig.json', content: '{"compilerOptions": {"target": "es2020"}}' },
      { path: 'src/App.tsx', content: 'export default function App() { return <div>App</div> }' },
      { path: 'src/main.tsx', content: 'import App from "./App"' },
      { path: 'src/index.css', content: 'body { margin: 0; }' },
      { path: 'README.md', content: '# Test App' },
    ];

    const files = await Promise.all(
      standardFiles.map(file => 
        this.create({
          websiteId,
          path: file.path,
          content: file.content,
        })
      )
    );
    return files;
  },

  async createMany(count: number, overrides: Override<typeof websiteFiles.$inferInsert> = {}) {
    let websiteId = overrides.websiteId;
    
    if (!websiteId) {
      const website = await websiteFactory.create();
      websiteId = Number(website.id);
    }

    const extensions = ['.tsx', '.ts', '.css', '.json', '.md'];
    const values = Array(count).fill(null).map((_, i) => {
      const ext = extensions[i % extensions.length];
      return this.build({ 
        ...overrides,
        websiteId,
        path: `src/file${i + 1}${ext}`,
      });
    });

    const results = await db.insert(websiteFiles)
      .values(values)
      .returning();
    return results;
  }
};

// Export all factories as a single object for convenience
export const factories = {
  project: projectFactory,
  account: accountFactory,
  website: websiteFactory,
  page: pageFactory,
  fileSpec: fileSpecFactory,
  componentOverview: componentOverviewFactory,
  contentStrategy: contentStrategyFactory,
  componentContentPlan: componentContentPlanFactory,
  theme: themeFactory,
  template: templateFactory,
  templateFiles: templateFilesFactory,
  component: componentFactory,
  task: taskFactory,
  codeTask: codeTaskFactory,
  createComponentCodeTask: createComponentCodeTaskFactory,
  websiteFiles: websiteFilesFactory,
};

// Helper function to clean up all test data
export async function truncateTables() {
  const pg = drizzle(process.env.POSTGRES_URI!);
  await reset(pg, schema);
}