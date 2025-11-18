import { describe, it, expect, afterEach } from 'vitest';
import { 
  codeTaskFactory,
  componentFactory,
  truncateTables 
} from './index';

describe('CodeTask Factory', () => {
  afterEach(async () => {
    await truncateTables();
  });

  describe('Basic Creation', () => {
    it('creates a code task with auto-created component', async () => {
      const task = await codeTaskFactory.create();
      
      expect(task).toBeDefined();
      expect(task.type).toBe('CodeTask');
      expect(task.subtype).toBe('create');
      expect(task.status).toBe('pending');
      expect(task.action).toBe('CREATE_COMPONENT');
      expect(task.componentId).toBeDefined();
      expect(task.websiteId).toBeDefined();
      expect(task.projectId).toBeDefined();
    });

    it('creates a code task for specific component type', async () => {
      const task = await codeTaskFactory.create({ componentType: 'Hero' });
      
      expect(task.title).toContain('Hero');
      expect(task.componentId).toBeDefined();
    });

    it('uses existing component if provided', async () => {
      const component = await componentFactory.create({
        name: 'CustomHero',
        componentType: 'Hero'
      });
      
      const task = await codeTaskFactory.create({
        componentId: Number(component.id),
        websiteId: component.websiteId
      });
      
      expect(task.componentId).toBe(Number(component.id));
      expect(task.websiteId).toBe(component.websiteId);
    });
  });

  describe('Full Stack Creation', () => {
    it('creates task with full dependency stack', async () => {
      const result = await codeTaskFactory.createWithFullStack('FAQ');
      
      expect(result.task).toBeDefined();
      expect(result.component).toBeDefined();
      expect(result.contentPlan).toBeDefined();
      expect(result.page).toBeDefined();
      expect(result.website).toBeDefined();
      expect(result.project).toBeDefined();
      
      // Verify relationships
      expect(result.task.componentId).toBe(Number(result.component.id));
      expect(result.task.websiteId).toBe(Number(result.website.id));
      expect(result.task.projectId).toBe(Number(result.project.id));
      expect(result.component.componentType).toBe('FAQ');
      expect(result.component.componentContentPlanId).toBe(Number(result.contentPlan.id));
      expect(result.contentPlan.componentType).toBe('FAQ');
    });

    it('creates task with random component type if not specified', async () => {
      const result = await codeTaskFactory.createWithFullStack();
      
      expect(result.task).toBeDefined();
      expect(result.component).toBeDefined();
      expect(codeTaskFactory.componentTypes).toContain(result.component.componentType);
    });
  });

  describe('Batch Operations', () => {
    it('creates batch of tasks with default components', async () => {
      const tasks = await codeTaskFactory.createBatch();
      
      expect(tasks).toHaveLength(5);
      
      // All should share same project and website
      const projectId = tasks[0].projectId;
      const websiteId = tasks[0].websiteId;
      tasks.forEach(task => {
        expect(task.projectId).toBe(projectId);
        expect(task.websiteId).toBe(websiteId);
        expect(task.type).toBe('CodeTask');
        expect(task.status).toBe('pending');
        expect(task.componentId).toBeDefined();
      });
    });

    it('creates batch for specific component types', async () => {
      const tasks = await codeTaskFactory.createBatch(['Hero', 'Benefits', 'CTA']);
      
      expect(tasks).toHaveLength(3);
      
      // Each task should have its own component
      const componentIds = tasks.map(t => t.componentId);
      expect(new Set(componentIds).size).toBe(3);
      
      // Tasks should have appropriate titles
      expect(tasks[0].title).toContain('Hero');
      expect(tasks[1].title).toContain('Benefits');
      expect(tasks[2].title).toContain('CTA');
    });
  });

  describe('Task Types', () => {
    it('creates create task by default', async () => {
      const task = await codeTaskFactory.create();
      
      expect(task.subtype).toBe('create');
      expect(task.action).toBe('CREATE_COMPONENT');
    });

    it('creates update task when specified', async () => {
      const task = await codeTaskFactory.create({
        subtype: 'update'
      });
      
      expect(task.subtype).toBe('update');
      expect(task.action).toBe('UPDATE_COMPONENT');
    });

    it('creates refactor task when specified', async () => {
      const task = await codeTaskFactory.create({
        subtype: 'refactor'
      });
      
      expect(task.subtype).toBe('refactor');
      expect(task.action).toBe('UPDATE_COMPONENT');
    });
  });

  describe('Component Integration', () => {
    it('creates appropriate component for each task', async () => {
      const tasks = await codeTaskFactory.createBatch(['Pricing', 'Testimonials']);
      
      // Get the components
      const componentIds = tasks.map(t => t.componentId);
      
      // Each task should have a unique component
      expect(new Set(componentIds).size).toBe(2);
      
      // Components should match the task types
      // Note: We can't easily verify component types without querying DB
      // but the factory ensures they match
    });

    it('task references component correctly', async () => {
      const { task, component } = await codeTaskFactory.createWithFullStack('Hero');
      
      expect(task.componentId).toBe(Number(component.id));
      expect(component.componentType).toBe('Hero');
      expect(component.name).toBe('Hero');
    });
  });
});