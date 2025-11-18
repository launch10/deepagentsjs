import { describe, it, expect, beforeEach } from 'vitest';
import { fileSpecFactory } from './index';
import { truncateTables } from './index';

describe('FileSpec Factory with Seed Data', () => {
  beforeEach(async () => {
    await truncateTables();
  });

  it('creates a Hero component with seed data', async () => {
    const heroSpec = await fileSpecFactory.create({ componentType: 'Hero' });
    
    expect(heroSpec.componentType).toBe('Hero');
    expect(heroSpec.canonicalPath).toBe('src/components/Hero.tsx');
    expect(heroSpec.description).toContain("prominent header section");
    expect(heroSpec.filetype).toBe('Section');
    expect(heroSpec.language).toBe('tsx');
  });

  it('creates a complete standard set of components', async () => {
    const specs = await fileSpecFactory.seed();
    
    expect(specs).toHaveLength(14); // All section + layout components
    
    const heroSpec = specs.find(s => s.componentType === 'Hero');
    expect(heroSpec).toBeDefined();
    expect(heroSpec?.canonicalPath).toBe('src/components/Hero.tsx');
  });

  it('creates all section components', async () => {
    const sections = await fileSpecFactory.createAllSections();
    
    expect(sections).toHaveLength(11); // All section components
    expect(sections.every(s => s.filetype === 'Section')).toBe(true);
  });

  it('creates all page specifications', async () => {
    const pages = await fileSpecFactory.createAllPages();
    
    expect(pages).toHaveLength(6);
    expect(pages.every(p => p.filetype === 'Page')).toBe(true);
    
    const indexPage = pages.find(p => p.componentType === 'IndexPage');
    expect(indexPage?.canonicalPath).toBe('src/pages/IndexPage.tsx');
  });

  it('creates complete project structure', async () => {
    const structure = await fileSpecFactory.createCompleteProjectStructure();
    
    expect(structure.sections).toHaveLength(11);
    expect(structure.layouts).toHaveLength(3);
    expect(structure.pages).toHaveLength(6);
    expect(structure.configs).toHaveLength(4);
    expect(structure.styles).toHaveLength(3);
  });

  it('finds or creates by component type', async () => {
    // First call creates
    const firstHero = await fileSpecFactory.findOrCreateByType('Hero');
    expect(firstHero.componentType).toBe('Hero');
    
    // Second call finds existing
    const secondHero = await fileSpecFactory.findOrCreateByType('Hero');
    expect(secondHero.id).toBe(firstHero.id);
  });

  it('uses seed data when componentType is provided', async () => {
    const ctaSpec = await fileSpecFactory.create({ componentType: 'CTA' });
    
    expect(ctaSpec.canonicalPath).toBe('src/components/CTA.tsx');
    expect(ctaSpec.description).toContain("call-to-action sections");
    expect(ctaSpec.filetype).toBe('Section');
  });

  it('allows overrides on seed data', async () => {
    const customHero = await fileSpecFactory.create({
      componentType: 'Hero',
      canonicalPath: 'src/custom/MyHero.tsx'
    });
    
    expect(customHero.componentType).toBe('Hero');
    expect(customHero.canonicalPath).toBe('src/custom/MyHero.tsx');
    expect(customHero.description).toContain("prominent header section"); // Still uses seed description
  });
});