import { describe, it, expect, afterEach } from 'vitest';
import { 
  componentFactory,
  taskFactory,
  websiteFilesFactory,
  websiteFactory,
  pageFactory,
  fileSpecFactory,
  componentContentPlanFactory,
  truncateTables 
} from './index';
import { WebsiteModel, ProjectModel } from '@models';

describe('Component, Task, and WebsiteFiles Factories', () => {
  afterEach(async () => {
    await truncateTables();
  });

  describe('Component Factory', () => {
    it('creates a basic component', async () => {
      const component = await componentFactory.create({
        name: 'HeroSection',
        componentType: 'Hero'
      });
      
      expect(component).toBeDefined();
      expect(component.name).toBe('HeroSection');
      expect(component.componentType).toBe('Hero');
      expect(component.websiteId).toBeDefined();
      expect(component.pageId).toBeDefined();
      expect(component.fileSpecificationId).toBeDefined();
    });

    it('creates component with content plan', async () => {
      const { component, contentPlan } = await componentFactory.createWithContentPlan(
        { name: 'TestHero' },
        { componentType: 'Hero' }
      );
      
      expect(component.name).toBe('TestHero');
      expect(component.componentType).toBe('Hero');
      expect(component.componentContentPlanId).toBe(Number(contentPlan.id));
      expect(contentPlan.componentType).toBe('Hero');
      expect(contentPlan.data).toBeDefined();
    });

    it('creates multiple components for same page', async () => {
      const website = await websiteFactory.create();
      const page = await pageFactory.create({ websiteId: Number(website.id) });
      
      const components = await componentFactory.createMany(3, {
        websiteId: Number(website.id),
        pageId: Number(page.id)
      });
      
      expect(components).toHaveLength(3);
      
      // All should belong to same website and page
      components.forEach(comp => {
        expect(comp.websiteId).toBe(Number(website.id));
        expect(comp.pageId).toBe(Number(page.id));
      });
      
      // Should have different component types
      const types = components.map(c => c.componentType);
      expect(types).toContain('Hero');
      expect(types).toContain('Benefits');
      expect(types).toContain('Features');
    });

    it('auto-creates all required dependencies', async () => {
      const component = await componentFactory.create();
      
      expect(component.websiteId).toBeDefined();
      expect(component.pageId).toBeDefined();
      expect(component.fileSpecificationId).toBeDefined();
    });
  });

  describe('Task Factory', () => {
    it('creates a basic task', async () => {
      const task = await taskFactory.create({
        title: 'Create landing page',
        type: 'CodeTask',
        subtype: 'create'
      });
      
      expect(task).toBeDefined();
      expect(task.title).toBe('Create landing page');
      expect(task.type).toBe('CodeTask');
      expect(task.subtype).toBe('create');
      expect(task.status).toBe('pending');
      expect(task.projectId).toBeDefined();
      expect(task.websiteId).toBeDefined();

      const project = await ProjectModel.find(task.projectId);  
      const website = await WebsiteModel.find(task.websiteId);
      expect(project.id).toEqual(task.projectId);
      expect(website.id).toEqual(task.websiteId);
    });

    it('creates a code task', async () => {
      const task = await taskFactory.createCodeTask({
        title: 'Implement Hero component'
      });
      
      expect(task.type).toBe('CodeTask');
      expect(task.subtype).toBe('create');
      expect(task.status).toBe('pending');
      expect(task.title).toBe('Implement Hero component');
    });

    it('creates task with component', async () => {
      const { task, component } = await taskFactory.createWithComponent(
        { instructions: 'Update styling' },
        { name: 'Hero', componentType: 'Hero' }
      );
      
      expect(task.componentId).toBe(Number(component.id));
      expect(task.title).toContain('Hero');
      expect(task.action).toBe('update_component');
      expect(component.name).toBe('Hero');
    });

    it('creates task with file specification', async () => {
      const { task, fileSpec } = await taskFactory.createWithFileSpec(
        { instructions: 'Build new component' },
        { componentType: 'CTA' }
      );
      
      expect(task.fileSpecificationId).toBe(Number(fileSpec.id));
      expect(task.title).toContain('CTA');
      expect(task.action).toBe('create_component');
      expect(fileSpec.componentType).toBe('CTA');
    });

    it('creates batch of tasks', async () => {
      const tasks = await taskFactory.createBatch(['create', 'update', 'refactor']);
      
      expect(tasks).toHaveLength(3);
      
      // All should have same project
      const projectId = tasks[0].projectId;
      tasks.forEach(task => {
        expect(task.projectId).toBe(projectId);
        expect(task.type).toBe('CodeTask');
        expect(task.status).toBe('pending');
      });
      
      // Check subtypes
      expect(tasks[0].subtype).toBe('create');
      expect(tasks[1].subtype).toBe('update');
      expect(tasks[2].subtype).toBe('refactor');
    });

    it('creates many tasks with various statuses', async () => {
      const tasks = await taskFactory.createMany(5);
      
      expect(tasks).toHaveLength(5);
      
      // Check status distribution
      const statuses = tasks.map(t => t.status);
      expect(statuses[0]).toBe('in_progress');
      expect(statuses[1]).toBe('pending');
      expect(statuses[2]).toBe('pending');
      expect(statuses[3]).toBe('completed');
      expect(statuses[4]).toBe('completed');
    });
  });

  describe('WebsiteFiles Factory', () => {
    it('creates a basic website file', async () => {
      const file = await websiteFilesFactory.create({
        path: 'src/components/Hero.tsx',
        content: 'export const Hero = () => <div>Hero</div>'
      });
      
      expect(file).toBeDefined();
      expect(file.path).toBe('src/components/Hero.tsx');
      expect(file.content).toContain('Hero');
      expect(file.websiteId).toBeDefined();
      expect(file.shasum).toBeDefined();
    });

    it('creates project files', async () => {
      const website = await websiteFactory.create();
      const files = await websiteFilesFactory.createProjectFiles(Number(website.id));
      
      expect(files).toHaveLength(6);
      
      const paths = files.map(f => f.path);
      expect(paths).toContain('package.json');
      expect(paths).toContain('tsconfig.json');
      expect(paths).toContain('src/App.tsx');
      expect(paths).toContain('src/main.tsx');
      expect(paths).toContain('src/index.css');
      expect(paths).toContain('README.md');
      
      // All should belong to same website
      files.forEach(file => {
        expect(file.websiteId).toBe(Number(website.id));
      });
    });

    it('creates multiple files with different extensions', async () => {
      const files = await websiteFilesFactory.createMany(5);
      
      expect(files).toHaveLength(5);
      
      const paths = files.map(f => f.path);
      expect(paths[0]).toContain('.tsx');
      expect(paths[1]).toContain('.ts');
      expect(paths[2]).toContain('.css');
      expect(paths[3]).toContain('.json');
      expect(paths[4]).toContain('.md');
    });

    it('auto-creates website if not provided', async () => {
      const file = await websiteFilesFactory.create({
        path: 'test.ts',
        content: 'test content'
      });
      
      expect(file.websiteId).toBeDefined();
    });
  });

  describe('Factory Integration', () => {
    it('creates a complete component with all associations', async () => {
      // Create website and page
      const website = await websiteFactory.create({ name: 'Test Site' });
      const page = await pageFactory.create({ 
        websiteId: Number(website.id),
        name: 'Home',
        pageType: 'IndexPage'
      });
      
      // Create component with content plan
      const { component, contentPlan } = await componentFactory.createWithContentPlan(
        {
          websiteId: Number(website.id),
          pageId: Number(page.id),
          name: 'Main Hero'
        },
        { componentType: 'Hero' }
      );
      
      // Create task for the component
      const task = await taskFactory.create({
        componentId: Number(component.id),
        title: 'Style the hero section',
        type: 'CodeTask',
        subtype: 'update',
        action: 'update_component'
      });
      
      // Create files for the website
      const files = await websiteFilesFactory.createProjectFiles(Number(website.id));
      
      // Verify all relationships
      expect(component.websiteId).toBe(Number(website.id));
      expect(component.pageId).toBe(Number(page.id));
      expect(component.componentContentPlanId).toBe(Number(contentPlan.id));
      expect(task.componentId).toBe(Number(component.id));
      expect(files).toHaveLength(6);
      files.forEach(file => {
        expect(file.websiteId).toBe(Number(website.id));
      });
    });

    it('creates multiple tasks for different components', async () => {
      const website = await websiteFactory.create();
      const page = await pageFactory.create({ websiteId: Number(website.id) });
      
      // Create multiple components
      const components = await componentFactory.createMany(3, {
        websiteId: Number(website.id),
        pageId: Number(page.id)
      });
      
      // Create tasks for each component
      const tasks = await Promise.all(
        components.map(comp => 
          taskFactory.create({
            componentId: Number(comp.id),
            title: `Update ${comp.name}`,
            action: 'update_component'
          })
        )
      );
      
      expect(tasks).toHaveLength(3);
      tasks.forEach((task, i) => {
        expect(task.componentId).toBe(Number(components[i].id));
        expect(task.title).toContain(components[i].name);
      });
    });
  });
});