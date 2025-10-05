import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  factories, 
  websiteFactory, 
  pageFactory, 
  fileSpecFactory, 
  componentOverviewFactory,
  truncateTables 
} from './index';

describe('Drizzle Factories', () => {
  // Clean up after each test to ensure isolation
  afterEach(async () => {
    await truncateTables();
  });

  describe('Website Factory', () => {
    it('creates a website with auto-generated project and account', async () => {
      const website = await websiteFactory.create({
        name: 'Test Website'
      });

      expect(website).toBeDefined();
      expect(website.name).toBe('Test Website');
      expect(website.projectId).toBeDefined();
      expect(website.accountId).toBeDefined();
    });

    it('creates a website with specific project and account', async () => {
      const project = await factories.project.create({ name: 'Test Project' });
      const account = await factories.account.create({ name: 'Test Account' });

      const website = await websiteFactory.create({
        name: 'Test Website',
        projectId: Number(project.id),
        accountId: Number(account.id)
      });

      expect(website.projectId).toBe(Number(project.id));
      expect(website.accountId).toBe(Number(account.id));
    });

    it('creates multiple websites with shared project/account', async () => {
      const websites = await websiteFactory.createMany(3);

      expect(websites).toHaveLength(3);
      // All websites should share the same project and account
      expect(websites[0].projectId).toBe(websites[1].projectId);
      expect(websites[0].accountId).toBe(websites[1].accountId);
    });

    it('creates website with all associations', async () => {
      const { website, project, account } = await websiteFactory.createWithAssociations();

      expect(website).toBeDefined();
      expect(project).toBeDefined();
      expect(account).toBeDefined();
      expect(website.projectId).toBe(Number(project.id));
      expect(website.accountId).toBe(Number(account.id));
    });
  });

  describe('Page Factory', () => {
    it('creates a page with auto-generated website', async () => {
      const page = await pageFactory.create({
        name: 'Home Page',
        pageType: 'IndexPage'
      });

      expect(page).toBeDefined();
      expect(page.name).toBe('Home Page');
      expect(page.pageType).toBe('IndexPage');
      expect(page.websiteId).toBeDefined();
    });

    it('creates multiple pages for the same website', async () => {
      const pages = await pageFactory.createMany(3);

      expect(pages).toHaveLength(3);
      // All pages should belong to the same website
      expect(pages[0].websiteId).toBe(pages[1].websiteId);
      expect(pages[1].websiteId).toBe(pages[2].websiteId);
      // But have different names and paths
      expect(pages[0].name).not.toBe(pages[1].name);
      expect(pages[0].path).not.toBe(pages[1].path);
    });

    it('creates page with website using helper method', async () => {
      const { page, website } = await pageFactory.createWithWebsite(
        { name: 'About Page', pageType: 'AboutPage' },
        { name: 'My Website' }
      );

      expect(page.name).toBe('About Page');
      expect(website.name).toBe('My Website');
      expect(page.websiteId).toBe(Number(website.id));
    });
  });

  describe('FileSpec Factory', () => {
    it('creates a single file specification', async () => {
      const fileSpec = await fileSpecFactory.create({
        componentType: 'Hero',
        canonicalPath: '/src/components/Hero.tsx'
      });

      expect(fileSpec).toBeDefined();
      expect(fileSpec.componentType).toBe('Hero');
      expect(fileSpec.canonicalPath).toBe('/src/components/Hero.tsx');
    });

    it('creates a standard set of file specifications', async () => {
      const specs = await fileSpecFactory.seed();

      expect(specs).toHaveLength(14); // All components in FILE_SPEC_SEEDS
      
      const componentTypes = specs.map(s => s.componentType);
      expect(componentTypes).toContain('Hero');
      expect(componentTypes).toContain('Benefits');
      expect(componentTypes).toContain('Features');
      expect(componentTypes).toContain('CTA');
      expect(componentTypes).toContain('Footer');
      expect(componentTypes).toContain('Nav');
    });

    it('creates multiple file specs with varied component types', async () => {
      const specs = await fileSpecFactory.createMany(3);

      expect(specs).toHaveLength(3);
      specs.forEach(spec => {
        expect(spec.componentType).toBeDefined();
        expect(spec.canonicalPath).toContain('/src/components/');
      });
    });
  });

  describe('ComponentOverview Factory', () => {
    it('creates overview with auto-generated relations', async () => {
      const overview = await componentOverviewFactory.create({
        componentType: 'Hero',
        purpose: 'Landing page hero section',
        backgroundColor: 'primary'
      });

      expect(overview).toBeDefined();
      expect(overview.componentType).toBe('Hero');
      expect(overview.purpose).toBe('Landing page hero section');
      expect(overview.websiteId).toBeDefined();
      expect(overview.pageId).toBeDefined();
      expect(overview.fileSpecificationId).toBeDefined();
    });

    it('creates overview with all explicit relations', async () => {
      const { overview, website, page, fileSpec } = await componentOverviewFactory.createWithAllRelations(
        { componentType: 'Benefits', purpose: 'Show product benefits' },
        { name: 'Product Site' },
        { name: 'Landing Page', pageType: 'LandingPage' },
        { componentType: 'Benefits' }
      );

      expect(overview.componentType).toBe('Benefits');
      expect(overview.purpose).toBe('Show product benefits');
      expect(overview.websiteId).toBe(Number(website.id));
      expect(overview.pageId).toBe(Number(page.id));
      expect(overview.fileSpecificationId).toBe(Number(fileSpec.id));
      expect(fileSpec.componentType).toBe('Benefits');
    });

    it('creates multiple overviews for the same page', async () => {
      const website = await websiteFactory.create();
      const page = await pageFactory.create({ websiteId: Number(website.id) });

      const overviews = await componentOverviewFactory.createMany(4, {
        websiteId: Number(website.id),
        pageId: Number(page.id)
      });

      expect(overviews).toHaveLength(4);
      
      // All should belong to the same website and page
      overviews.forEach(overview => {
        expect(overview.websiteId).toBe(Number(website.id));
        expect(overview.pageId).toBe(Number(page.id));
      });

      // But have different component types
      const types = overviews.map(o => o.componentType);
      
      expect(new Set(types).size).toBeGreaterThan(1); // Should have variety
    });

    it('creates a complete page structure with multiple components', async () => {
      // Create a complete website structure
      const website = await websiteFactory.create({ name: 'E-commerce Site' });
      const page = await pageFactory.create({ 
        websiteId: Number(website.id),
        name: 'Home',
        pageType: 'IndexPage'
      });

      // Create multiple component overviews for the page
      const overviews = await componentOverviewFactory.createMany(5, {
        websiteId: Number(website.id),
        pageId: Number(page.id)
      });

      expect(overviews).toHaveLength(5);
      
      // Verify the complete structure
      overviews.forEach((overview, index) => {
        expect(overview.websiteId).toBe(Number(website.id));
        expect(overview.pageId).toBe(Number(page.id));
        expect(overview.fileSpecificationId).toBeDefined();
      });
    });
  });

  describe('Factory Composition', () => {
    it('creates a complex website structure with multiple pages and components', async () => {
      // Create website with associations
      const { website, project, account } = await websiteFactory.createWithAssociations();

      // Create multiple pages
      const homePage = await pageFactory.create({ 
        websiteId: Number(website.id),
        name: 'Home',
        pageType: 'IndexPage'
      });

      const aboutPage = await pageFactory.create({ 
        websiteId: Number(website.id),
        name: 'About',
        pageType: 'AboutPage'
      });

      // Create components for home page
      const homeComponents = await componentOverviewFactory.createMany(3, {
        websiteId: Number(website.id),
        pageId: Number(homePage.id)
      });

      // Create components for about page
      const aboutComponents = await componentOverviewFactory.createMany(2, {
        websiteId: Number(website.id),
        pageId: Number(aboutPage.id)
      });

      // Verify the structure
      expect(website).toBeDefined();
      expect(project).toBeDefined();
      expect(account).toBeDefined();
      expect(homeComponents).toHaveLength(3);
      expect(aboutComponents).toHaveLength(2);

      // All components should be properly associated
      homeComponents.forEach(comp => {
        expect(comp.websiteId).toBe(Number(website.id));
        expect(comp.pageId).toBe(Number(homePage.id));
      });

      aboutComponents.forEach(comp => {
        expect(comp.websiteId).toBe(Number(website.id));
        expect(comp.pageId).toBe(Number(aboutPage.id));
      });
    });
  });
});