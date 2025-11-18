import { describe, it, expect, afterEach } from 'vitest';
import { 
  contentStrategyFactory,
  pagePlanFactory,
  componentContentPlanFactory,
  themeFactory,
  websiteFactory,
  pageFactory,
  componentOverviewFactory,
  truncateTables 
} from './index';

describe('Content Strategy Factories', () => {
  afterEach(async () => {
    await truncateTables();
  });

  describe('Content Strategy Factory', () => {
    it('creates a content strategy with random data', async () => {
      const strategy = await contentStrategyFactory.create();
      
      expect(strategy).toBeDefined();
      expect(strategy.tone).toBeDefined();
      expect(strategy.coreEmotionalDriver).toBeDefined();
      expect(strategy.attentionGrabber).toBeDefined();
      expect(strategy.callToAction).toBeDefined();
      expect(strategy.landingPageCopy).toBeDefined();
    });

    it('creates a B2B SaaS content strategy', async () => {
      const strategy = await contentStrategyFactory.createB2BSaaS();
      
      expect(strategy.tone).toBe('Professional yet approachable');
      expect(strategy.coreEmotionalDriver).toBe('Fear of falling behind competitors');
      expect(strategy.attentionGrabber).toBe('Transform Your Business Today');
      expect(strategy.callToAction).toBe('Start Free Trial');
    });

    it('creates an e-commerce content strategy', async () => {
      const strategy = await contentStrategyFactory.createEcommerce();
      
      expect(strategy.tone).toBe('Friendly and conversational');
      expect(strategy.coreEmotionalDriver).toBe('Desire for quality and value');
      expect(strategy.attentionGrabber).toBe('Discover Amazing Products');
      expect(strategy.callToAction).toBe('Shop Now');
    });

    it('creates strategy with associated website', async () => {
      const { strategy, website } = await contentStrategyFactory.createWithWebsite(
        { tone: 'Bold and innovative' },
        { name: 'Tech Startup' }
      );
      
      expect(strategy.tone).toBe('Bold and innovative');
      expect(strategy.websiteId).toBe(Number(website.id));
      expect(website.name).toBe('Tech Startup');
    });
  });

  describe('Page Plan Factory', () => {
    it('creates a single page plan', async () => {
      const pagePlan = await pagePlanFactory.create({
        pageType: 'IndexPage',
        description: 'Main landing page'
      });
      
      expect(pagePlan).toBeDefined();
      expect(pagePlan.pageType).toBe('IndexPage');
      expect(pagePlan.description).toBe('Main landing page');
      expect(pagePlan.websiteId).toBeDefined();
    });

    it('creates multiple page plans for the same website', async () => {
      const pagePlans = await pagePlanFactory.createMany(3);
      
      expect(pagePlans).toHaveLength(3);
      // All should have the same website
      expect(pagePlans[0].websiteId).toBe(pagePlans[1].websiteId);
      expect(pagePlans[1].websiteId).toBe(pagePlans[2].websiteId);
      // But different page types
      const types = pagePlans.map(p => p.pageType);
      expect(new Set(types).size).toBeGreaterThan(1);
    });

    it('creates a full site plan', async () => {
      const website = await websiteFactory.create({ name: 'Complete Site' });
      const plans = await pagePlanFactory.createFullSitePlan(Number(website.id));
      
      expect(plans).toHaveLength(4);
      
      const pageTypes = plans.map(p => p.pageType);
      expect(pageTypes).toContain('IndexPage');
      expect(pageTypes).toContain('AboutPage');
      expect(pageTypes).toContain('PricingPage');
      expect(pageTypes).toContain('ContactPage');
      
      // All should belong to the same website
      plans.forEach(plan => {
        expect(plan.websiteId).toBe(Number(website.id));
      });
    });
  });

  describe('Component Content Plan Factory', () => {
    it('creates a Hero component content plan', async () => {
      const plan = await componentContentPlanFactory.create({
        componentType: 'Hero'
      });
      
      expect(plan).toBeDefined();
      expect(plan.componentType).toBe('Hero');
      expect(plan.data).toHaveProperty('headline');
      expect(plan.data).toHaveProperty('subheadline');
      expect(plan.data).toHaveProperty('ctaText');
      expect(plan.componentOverviewId).toBeDefined();
    });

    it('creates Benefits component content plan with seed data', async () => {
      const plan = await componentContentPlanFactory.create({
        componentType: 'Benefits'
      });
      
      expect(plan.componentType).toBe('Benefits');
      expect(plan.data).toHaveProperty('benefits');
      expect(Array.isArray(plan.data.benefits)).toBe(true);
      expect(plan.data.benefits[0]).toHaveProperty('statement');
      expect(plan.data.benefits[0]).toHaveProperty('elaboration');
    });

    it('creates content plan with overview', async () => {
      const { plan, overview } = await componentContentPlanFactory.createWithOverview(
        { componentType: 'CTA' },
        { name: 'Main CTA', purpose: 'Drive conversions' }
      );
      
      expect(plan.componentType).toBe('CTA');
      expect(plan.componentOverviewId).toBe(Number(overview.id));
      expect(overview.name).toBe('Main CTA');
      expect(overview.purpose).toBe('Drive conversions');
      expect(overview.componentType).toBe('CTA');
    });

    it('creates full page content plans', async () => {
      const website = await websiteFactory.create();
      const page = await pageFactory.create({ websiteId: Number(website.id) });
      
      const plans = await componentContentPlanFactory.createFullPageContentPlans(
        Number(page.id),
        Number(website.id)
      );
      
      expect(plans).toHaveLength(4);
      
      const types = plans.map(p => p.componentType);
      expect(types).toContain('Hero');
      expect(types).toContain('Benefits');
      expect(types).toContain('Features');
      expect(types).toContain('CTA');
    });
  });

  describe('Theme Factory', () => {
    it('creates a theme with random data', async () => {
      const theme = await themeFactory.create();
      
      expect(theme).toBeDefined();
      expect(theme.name).toBeDefined();
      expect(theme.colors).toBeDefined();
      expect(theme.theme).toBeDefined();
    });

    it('creates a theme with specific colors', async () => {
      const theme = await themeFactory.create({
        name: 'Custom',
        colors: {
          primary: '#FF0000',
          secondary: '#00FF00',
          accent: '#0000FF',
          background: '#FFFFFF',
          foreground: '#000000',
        }
      });
      
      expect(theme.name).toBe('Custom');
      expect(theme.colors.primary).toBe('#FF0000');
      expect(theme.colors.secondary).toBe('#00FF00');
    });

    it('creates standard theme set', async () => {
      const themes = await themeFactory.createStandardThemes();
      
      expect(themes).toHaveLength(3);
      
      const names = themes.map(t => t.name);
      expect(names).toContain('Modern');
      expect(names).toContain('Dark');
      expect(names).toContain('Minimal');
      
      // Check Modern theme colors
      const modern = themes.find(t => t.name === 'Modern');
      expect(modern?.colors.primary).toBe('#3B82F6');
    });
  });

  describe('Factory Integration', () => {
    it('creates a complete website structure with content strategy', async () => {
      // Create website with theme
      const theme = await themeFactory.create({ name: 'Corporate' });
      const website = await websiteFactory.create({ 
        name: 'Corporate Site',
        themeId: Number(theme.id)
      });
      
      // Create content strategy
      const strategy = await contentStrategyFactory.createB2BSaaS(Number(website.id));
      
      // Create page plans
      const pagePlans = await pagePlanFactory.createFullSitePlan(Number(website.id));
      
      // Create actual pages
      const indexPage = await pageFactory.create({
        websiteId: Number(website.id),
        pageType: 'IndexPage',
        name: 'Home'
      });
      
      // Create component content plans for the index page
      const contentPlans = await componentContentPlanFactory.createFullPageContentPlans(
        Number(indexPage.id),
        Number(website.id)
      );
      
      // Verify the complete structure
      expect(website.themeId).toBe(Number(theme.id));
      expect(strategy.websiteId).toBe(Number(website.id));
      expect(pagePlans).toHaveLength(4);
      expect(contentPlans).toHaveLength(4);
      
      // Verify content strategy properties
      expect(strategy.tone).toBe('Professional yet approachable');
      expect(strategy.callToAction).toBe('Start Free Trial');
      
      // Verify component content plans have proper data
      const heroPlan = contentPlans.find(p => p.componentType === 'Hero');
      expect(heroPlan?.data.headline).toBe('Transform Your Business Today');
    });

    it('creates multiple websites with different strategies', async () => {
      // Create B2B SaaS site
      const saasWebsite = await websiteFactory.create({ name: 'SaaS Platform' });
      const saasStrategy = await contentStrategyFactory.createB2BSaaS(Number(saasWebsite.id));
      
      // Create E-commerce site
      const shopWebsite = await websiteFactory.create({ name: 'Online Shop' });
      const shopStrategy = await contentStrategyFactory.createEcommerce(Number(shopWebsite.id));
      
      expect(saasStrategy.websiteId).toBe(Number(saasWebsite.id));
      expect(shopStrategy.websiteId).toBe(Number(shopWebsite.id));
      
      expect(saasStrategy.tone).not.toBe(shopStrategy.tone);
      expect(saasStrategy.callToAction).toBe('Start Free Trial');
      expect(shopStrategy.callToAction).toBe('Shop Now');
    });
  });
});