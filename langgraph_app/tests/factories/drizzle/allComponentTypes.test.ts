import { describe, it, expect, afterEach } from 'vitest';
import { 
  componentContentPlanFactory,
  websiteFactory,
  pageFactory,
  truncateTables 
} from './index';

describe('Component Content Plan Factory - All Types', () => {
  afterEach(async () => {
    await truncateTables();
  });

  describe('All Component Types', () => {
    const allComponentTypes = [
      'Hero', 'Benefits', 'CTA', 'Features', 'FAQ', 
      'HowItWorks', 'Pricing', 'SocialProof', 'Team', 
      'Testimonials', 'Custom'
    ];

    allComponentTypes.forEach(type => {
      it(`creates ${type} component content plan with seed data`, async () => {
        const plan = await componentContentPlanFactory.create({
          componentType: type
        });
        
        expect(plan).toBeDefined();
        expect(plan.componentType).toBe(type);
        expect(plan.data).toBeDefined();
        expect(plan.componentOverviewId).toBeDefined();
        
        // Verify specific properties for each type
        switch(type) {
          case 'Hero':
            expect(plan.data.headline).toBeDefined();
            expect(plan.data.subheadline).toBeDefined();
            expect(plan.data.ctaText).toBeDefined();
            expect(plan.data.trustSignals).toBeInstanceOf(Array);
            expect(plan.data.suggestedComponents).toContain('Button');
            break;
            
          case 'Benefits':
            expect(plan.data.benefits).toBeInstanceOf(Array);
            expect(plan.data.benefits[0]).toHaveProperty('statement');
            expect(plan.data.benefits[0]).toHaveProperty('elaboration');
            expect(plan.data.benefits[0]).toHaveProperty('visual');
            break;
            
          case 'Features':
            expect(plan.data.features).toBeInstanceOf(Array);
            expect(plan.data.features[0]).toHaveProperty('name');
            expect(plan.data.features[0]).toHaveProperty('description');
            expect(plan.data.features).toHaveLength(4); // We added 4 features
            break;
            
          case 'Pricing':
            expect(plan.data.plans).toBeInstanceOf(Array);
            expect(plan.data.plans).toHaveLength(3);
            expect(plan.data.plans[0]).toHaveProperty('name');
            expect(plan.data.plans[0]).toHaveProperty('price');
            expect(plan.data.plans[0]).toHaveProperty('features');
            expect(plan.data.plans[1].badge).toBe('Most Popular');
            break;
            
          case 'FAQ':
            expect(plan.data.qaPairs).toBeInstanceOf(Array);
            expect(plan.data.qaPairs).toHaveLength(5);
            expect(plan.data.qaPairs[0]).toHaveProperty('question');
            expect(plan.data.qaPairs[0]).toHaveProperty('answer');
            break;
            
          case 'Testimonials':
            expect(plan.data.testimonials).toBeInstanceOf(Array);
            expect(plan.data.testimonials[0]).toHaveProperty('quote');
            expect(plan.data.testimonials[0]).toHaveProperty('author');
            expect(plan.data.testimonials[0]).toHaveProperty('rating');
            expect(plan.data.testimonials[0].rating).toBe(5);
            break;
            
          case 'Team':
            expect(plan.data.teamMembers).toBeInstanceOf(Array);
            expect(plan.data.teamMembers[0]).toHaveProperty('name');
            expect(plan.data.teamMembers[0]).toHaveProperty('role');
            expect(plan.data.teamMembers[0]).toHaveProperty('bio');
            expect(plan.data.teamMembers[0]).toHaveProperty('socialLinks');
            break;
            
          case 'SocialProof':
            expect(plan.data.trustSignals).toBeInstanceOf(Array);
            expect(plan.data.trustSignals).toHaveLength(6);
            expect(plan.data.trustSignals[0]).toHaveProperty('type');
            expect(plan.data.trustSignals.some(s => s.type === 'logo')).toBe(true);
            expect(plan.data.trustSignals.some(s => s.type === 'statistic')).toBe(true);
            break;
            
          case 'HowItWorks':
            expect(plan.data.steps).toBeInstanceOf(Array);
            expect(plan.data.steps).toHaveLength(3);
            expect(plan.data.steps[0]).toHaveProperty('title');
            expect(plan.data.steps[0]).toHaveProperty('description');
            expect(plan.data.steps[0]).toHaveProperty('visual');
            break;
            
          case 'CTA':
            expect(plan.data.cta).toBeDefined();
            expect(plan.data.cta.text).toBe('Start Free Trial');
            expect(plan.data.cta.variant).toBe('primary');
            expect(plan.data.cta.size).toBe('large');
            expect(plan.data.supportingVisualOrTrustSignal).toBeDefined();
            break;
            
          case 'Custom':
            expect(plan.data.content).toBeDefined();
            expect(plan.data.layoutDescription).toContain('Flexible');
            break;
        }
        
        // All types should have layout and styling information
        expect(plan.data.suggestedComponents).toBeDefined();
        expect(plan.data.layoutDescription).toBeDefined();
        expect(plan.data.visualStyleNotes).toBeDefined();
      });
    });
  });

  describe('Page-specific Content Plans', () => {
    it('creates landing page content plans', async () => {
      const website = await websiteFactory.create();
      const page = await pageFactory.create({ 
        websiteId: Number(website.id),
        pageType: 'IndexPage'
      });
      
      const plans = await componentContentPlanFactory.createLandingPagePlans(
        Number(page.id),
        Number(website.id)
      );
      
      expect(plans).toHaveLength(6);
      const types = plans.map(p => p.componentType);
      expect(types).toContain('Hero');
      expect(types).toContain('Benefits');
      expect(types).toContain('Features');
      expect(types).toContain('SocialProof');
      expect(types).toContain('Testimonials');
      expect(types).toContain('CTA');
    });

    it('creates pricing page content plans', async () => {
      const website = await websiteFactory.create();
      const page = await pageFactory.create({ 
        websiteId: Number(website.id),
        pageType: 'PricingPage'
      });
      
      const plans = await componentContentPlanFactory.createPricingPagePlans(
        Number(page.id),
        Number(website.id)
      );
      
      expect(plans).toHaveLength(5);
      const types = plans.map(p => p.componentType);
      expect(types).toContain('Hero');
      expect(types).toContain('Pricing');
      expect(types).toContain('FAQ');
      expect(types).toContain('Testimonials');
      expect(types).toContain('CTA');
    });

    it('creates about page content plans', async () => {
      const website = await websiteFactory.create();
      const page = await pageFactory.create({ 
        websiteId: Number(website.id),
        pageType: 'AboutPage'
      });
      
      const plans = await componentContentPlanFactory.createAboutPagePlans(
        Number(page.id),
        Number(website.id)
      );
      
      expect(plans).toHaveLength(5);
      const types = plans.map(p => p.componentType);
      expect(types).toContain('Hero');
      expect(types).toContain('Team');
      expect(types).toContain('Benefits');
      expect(types).toContain('Testimonials');
      expect(types).toContain('CTA');
    });

    it('creates full page with default components', async () => {
      const website = await websiteFactory.create();
      const page = await pageFactory.create({ websiteId: Number(website.id) });
      
      const plans = await componentContentPlanFactory.createFullPageContentPlans(
        Number(page.id),
        Number(website.id)
      );
      
      expect(plans).toHaveLength(8);
      const types = plans.map(p => p.componentType);
      
      // Should have a comprehensive set of components
      expect(types).toContain('Hero');
      expect(types).toContain('Benefits');
      expect(types).toContain('Features');
      expect(types).toContain('HowItWorks');
      expect(types).toContain('Testimonials');
      expect(types).toContain('Pricing');
      expect(types).toContain('FAQ');
      expect(types).toContain('CTA');
    });
  });

  describe('Helper Methods', () => {
    it('creates individual Hero plan', async () => {
      const plan = await componentContentPlanFactory.createHeroPlan();
      
      expect(plan.componentType).toBe('Hero');
      expect(plan.data.headline).toBe('Transform Your Business Today');
    });

    it('creates individual Pricing plan', async () => {
      const plan = await componentContentPlanFactory.createPricingPlan();
      
      expect(plan.componentType).toBe('Pricing');
      expect(plan.data.plans).toHaveLength(3);
      expect(plan.data.plans[0].name).toBe('Starter');
      expect(plan.data.plans[1].name).toBe('Professional');
      expect(plan.data.plans[2].name).toBe('Enterprise');
    });

    it('creates individual FAQ plan', async () => {
      const plan = await componentContentPlanFactory.createFAQPlan();
      
      expect(plan.componentType).toBe('FAQ');
      expect(plan.data.qaPairs).toHaveLength(5);
      expect(plan.data.qaPairs[0].question).toContain('pricing');
    });
  });

  describe('Data Integrity', () => {
    it('ensures all component types have complete seed data', async () => {
      const allTypes = [
        'Hero', 'Benefits', 'CTA', 'Features', 'FAQ', 
        'HowItWorks', 'Pricing', 'SocialProof', 'Team', 
        'Testimonials', 'Custom'
      ];
      
      for (const type of allTypes) {
        const plan = await componentContentPlanFactory.create({ componentType: type });
        
        // All should have basic structure
        expect(plan.data.headline).toBeDefined();
        expect(plan.data.suggestedComponents).toBeDefined();
        expect(plan.data.layoutDescription).toBeDefined();
        expect(plan.data.visualStyleNotes).toBeDefined();
        
        // Verify no empty data
        expect(Object.keys(plan.data).length).toBeGreaterThan(3);
      }
    });

    it('maintains relationships between overview and content plan', async () => {
      const { plan, overview } = await componentContentPlanFactory.createWithOverview(
        { componentType: 'Testimonials' },
        { name: 'Customer Reviews', purpose: 'Build trust' }
      );
      
      expect(plan.componentOverviewId).toBe(Number(overview.id));
      expect(plan.componentType).toBe(overview.componentType);
      expect(overview.name).toBe('Customer Reviews');
      expect(overview.purpose).toBe('Build trust');
      
      // Verify testimonial data
      expect(plan.data.testimonials).toBeDefined();
      expect(plan.data.testimonials.length).toBeGreaterThan(0);
    });
  });
});