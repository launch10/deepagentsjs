import { describe, it, expect, afterEach } from 'vitest';
import { 
  createComponentCodeTaskFactory,
  truncateTables 
} from './index';

describe('CreateComponentCodeTask Factory', () => {
  afterEach(async () => {
    await truncateTables();
  });

  describe('Basic Creation', () => {
    it('creates a complete component creation task with full hierarchy', async () => {
      const result = await createComponentCodeTaskFactory.create();
      
      // Verify all entities were created
      expect(result.task).toBeDefined();
      expect(result.component).toBeDefined();
      expect(result.componentOverview).toBeDefined();
      expect(result.componentContentPlan).toBeDefined();
      expect(result.page).toBeDefined();
      expect(result.website).toBeDefined();
      expect(result.project).toBeDefined();
      
      // Verify task properties
      expect(result.task.type).toBe('CodeTask');
      expect(result.task.subtype).toBe('create');
      expect(result.task.action).toBe('CREATE_COMPONENT');
      expect(result.task.status).toBe('pending');
      expect(result.task.componentId).toBe(Number(result.component.id));
      expect(result.task.websiteId).toBe(Number(result.website.id));
      expect(result.task.projectId).toBe(Number(result.project.id));
      expect(result.task.fileSpecificationId).toBe(result.component.fileSpecificationId);
      
      // Verify component hierarchy
      expect(result.component.componentPlanId).toBe(Number(result.componentOverview.id));
      expect(result.component.componentContentPlanId).toBe(Number(result.componentContentPlan.id));
      expect(result.componentContentPlan.componentOverviewId).toBe(Number(result.componentOverview.id));
      
      // Verify component types match
      expect(result.component.componentType).toBe(result.componentOverview.componentType);
      expect(result.component.componentType).toBe(result.componentContentPlan.componentType);
    });

    it('creates task for specific component type', async () => {
      const result = await createComponentCodeTaskFactory.create({ componentType: 'Hero' });
      
      expect(result.task.title).toBe('Create Hero component');
      expect(result.component.name).toBe('Hero');
      expect(result.component.componentType).toBe('Hero');
      expect(result.componentOverview.name).toBe('Hero Section');
      expect(result.componentOverview.purpose).toContain('hero');
      expect(result.componentContentPlan.componentType).toBe('Hero');
      
      // Verify Hero-specific content plan data
      expect(result.componentContentPlan.data).toBeDefined();
      expect(result.componentContentPlan.data.headline).toBeDefined();
      expect(result.componentContentPlan.data.subheadline).toBeDefined();
    });

    it('creates task with custom overrides', async () => {
      const result = await createComponentCodeTaskFactory.create({
        title: 'Build custom FAQ section',
        instructions: 'Create an accordion-style FAQ',
        componentType: 'FAQ'
      });
      
      expect(result.task.title).toBe('Build custom FAQ section');
      expect(result.task.instructions).toBe('Create an accordion-style FAQ');
      expect(result.component.componentType).toBe('FAQ');
      expect(result.componentContentPlan.data.qaPairs).toBeDefined();
    });
  });

  describe('Batch Operations', () => {
    it('creates batch of component creation tasks', async () => {
      const tasks = await createComponentCodeTaskFactory.createBatch(['Hero', 'Benefits', 'CTA']);
      
      expect(tasks).toHaveLength(3);
      
      // All should share same project and website
      const projectId = tasks[0].projectId;
      const websiteId = tasks[0].websiteId;
      
      tasks.forEach(task => {
        expect(task.projectId).toBe(projectId);
        expect(task.websiteId).toBe(websiteId);
        expect(task.type).toBe('CodeTask');
        expect(task.subtype).toBe('create');
        expect(task.action).toBe('CREATE_COMPONENT');
        expect(task.componentId).toBeDefined();
      });
      
      // Each should have appropriate title
      expect(tasks[0].title).toContain('Hero');
      expect(tasks[1].title).toContain('Benefits');
      expect(tasks[2].title).toContain('CTA');
    });

    it('creates batch with default component types', async () => {
      const tasks = await createComponentCodeTaskFactory.createBatch();
      
      expect(tasks).toHaveLength(5);
      
      const titles = tasks.map(t => t.title);
      expect(titles[0]).toContain('Hero');
      expect(titles[1]).toContain('Benefits');
      expect(titles[2]).toContain('Features');
      expect(titles[3]).toContain('CTA');
      expect(titles[4]).toContain('FAQ');
    });
  });

  describe('Minimal Dependencies', () => {
    it('creates task with minimal dependencies', async () => {
      const result = await createComponentCodeTaskFactory.createWithMinimalDeps('Pricing');
      
      expect(result.task).toBeDefined();
      expect(result.project).toBeDefined();
      expect(result.website).toBeDefined();
      expect(result.component.componentType).toBe('Pricing');
      expect(result.task.title).toBe('Create Pricing component');
      
      // Verify pricing-specific content
      expect(result.componentContentPlan.data.plans).toBeDefined();
      expect(result.componentContentPlan.data.plans).toHaveLength(3);
    });

    it('creates task with random component type when not specified', async () => {
      const result = await createComponentCodeTaskFactory.createWithMinimalDeps();
      
      expect(result.task).toBeDefined();
      expect(createComponentCodeTaskFactory.componentTypes).toContain(result.component.componentType);
    });
  });

  describe('Component Hierarchy Integrity', () => {
    it('ensures all relationships are properly connected', async () => {
      const result = await createComponentCodeTaskFactory.create({ componentType: 'Testimonials' });
      
      // Task -> Component
      expect(result.task.componentId).toBe(Number(result.component.id));
      
      // Component -> Overview
      expect(result.component.componentPlanId).toBe(Number(result.componentOverview.id));
      
      // Component -> Content Plan
      expect(result.component.componentContentPlanId).toBe(Number(result.componentContentPlan.id));
      
      // Content Plan -> Overview
      expect(result.componentContentPlan.componentOverviewId).toBe(Number(result.componentOverview.id));
      
      // Component -> Page
      expect(result.component.pageId).toBe(Number(result.page.id));
      
      // Component -> Website
      expect(result.component.websiteId).toBe(Number(result.website.id));
      
      // Website -> Project
      expect(result.website.projectId).toBe(Number(result.project.id));
    });

    it('ensures component types are consistent throughout hierarchy', async () => {
      const componentTypes = ['Hero', 'FAQ', 'Pricing', 'Team'];
      
      for (const componentType of componentTypes) {
        const result = await createComponentCodeTaskFactory.create({ componentType });
        
        expect(result.component.componentType).toBe(componentType);
        expect(result.componentOverview.componentType).toBe(componentType);
        expect(result.componentContentPlan.componentType).toBe(componentType);
        
        await truncateTables(); // Clean between iterations
      }
    });
  });

  describe('Content Plan Data', () => {
    it('creates appropriate content plan data for each component type', async () => {
      // Test Hero
      const heroResult = await createComponentCodeTaskFactory.create({ componentType: 'Hero' });
      expect(heroResult.componentContentPlan.data.headline).toBeDefined();
      expect(heroResult.componentContentPlan.data.ctaText).toBeDefined();
      
      await truncateTables();
      
      // Test FAQ
      const faqResult = await createComponentCodeTaskFactory.create({ componentType: 'FAQ' });
      expect(faqResult.componentContentPlan.data.qaPairs).toBeDefined();
      expect(faqResult.componentContentPlan.data.qaPairs).toHaveLength(5);
      
      await truncateTables();
      
      // Test Pricing
      const pricingResult = await createComponentCodeTaskFactory.create({ componentType: 'Pricing' });
      expect(pricingResult.componentContentPlan.data.plans).toBeDefined();
      expect(pricingResult.componentContentPlan.data.plans).toHaveLength(3);
      
      await truncateTables();
      
      // Test Team
      const teamResult = await createComponentCodeTaskFactory.create({ componentType: 'Team' });
      expect(teamResult.componentContentPlan.data.teamMembers).toBeDefined();
      expect(teamResult.componentContentPlan.data.teamMembers[0]).toHaveProperty('name');
      expect(teamResult.componentContentPlan.data.teamMembers[0]).toHaveProperty('role');
    });
  });
});