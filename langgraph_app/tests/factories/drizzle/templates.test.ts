import { describe, it, expect, afterEach } from 'vitest';
import { 
  templateFactory,
  templateFilesFactory,
  truncateTables 
} from './index';
import { TemplateFileModel } from '@models';

describe('Template Factories', () => {
  afterEach(async () => {
    await truncateTables();
  });

  describe('Template Factory', () => {
    it('creates a basic template', async () => {
      const template = await templateFactory.create({
        name: 'custom-template'
      });
      
      expect(template).toBeDefined();
      expect(template.name).toBe('custom-template');
    });

    it('creates default template with all files', async () => {
      const template = await templateFactory.createDefault();
      
      expect(template.name).toBe('default');
    });

    it('creates template with specific number of files', async () => {
      const template = await templateFactory.createWithFiles(
        { name: 'minimal-template' },
        5
      );
      
      expect(template.name).toBe('minimal-template');
    });
  });

  describe('Template Files Factory', () => {
    it('creates a single template file', async () => {
      const file = await templateFilesFactory.create({
        path: 'test.ts',
        content: 'export const test = true;'
      });
      
      expect(file).toBeDefined();
      expect(file.path).toBe('test.ts');
      expect(file.content).toBe('export const test = true;');
      expect(file.templateId).toBeDefined();
    });

    it('creates file from seed data', async () => {
      const file = await templateFilesFactory.createFromSeed(0);
      
      expect(file.path).toBe('components.json');
      expect(file.content).toContain('schema.json');
      expect(file.content).toContain('tailwind');
    });

    it('creates multiple files using seed data', async () => {
      const files = await templateFilesFactory.createMany(10);
      
      expect(files).toHaveLength(10);
      
      // First files should use seed data
      expect(files[0].path).toBe('components.json');
      expect(files[1].path).toBe('eslint.config.js');
      expect(files[2].path).toBe('index.html');
      expect(files[3].path).toBe('package.json');
      
      // All should belong to the same template
      const templateId = files[0].templateId;
      files.forEach(file => {
        expect(file.templateId).toBe(templateId);
      });
    });

    it('creates all template files for a template', async () => {
      const template = await templateFactory.create({ name: 'full-template' });
      const files = await templateFilesFactory.createAllForTemplate(Number(template.id));
      
      expect(files).toHaveLength(70);
      
      // Verify some key files are present
      const filePaths = files.map(f => f.path);
      expect(filePaths).toContain('package.json');
      expect(filePaths).toContain('tsconfig.json');
      expect(filePaths).toContain('vite.config.ts');
      expect(filePaths).toContain('src/App.tsx');
      expect(filePaths).toContain('src/main.tsx');
      expect(filePaths).toContain('src/index.css');
      expect(filePaths).toContain('index.html');
      
      // Check UI components
      expect(filePaths).toContain('src/components/ui/button.tsx');
      expect(filePaths).toContain('src/components/ui/card.tsx');
      expect(filePaths).toContain('src/components/ui/dialog.tsx');
      
      // All should belong to the same template
      files.forEach(file => {
        expect(file.templateId).toBe(Number(template.id));
      });
    });

    it('creates only core files', async () => {
      const template = await templateFactory.create({ name: 'minimal' });
      const files = await templateFilesFactory.createCoreFiles(Number(template.id));
      
      expect(files.length).toBeLessThan(10);
      
      const filePaths = files.map(f => f.path);
      expect(filePaths).toContain('package.json');
      expect(filePaths).toContain('tsconfig.json');
      expect(filePaths).toContain('vite.config.ts');
      expect(filePaths).toContain('src/App.tsx');
      expect(filePaths).toContain('src/main.tsx');
      expect(filePaths).toContain('src/index.css');
      expect(filePaths).toContain('index.html');
    });
  });

  describe('Template File Content', () => {
    it('properly handles JSON content', async () => {
      const file = await templateFilesFactory.createFromSeed(0); // components.json
      
      const content = JSON.parse(file.content);
      expect(content.$schema).toBe('https://ui.shadcn.com/schema.json');
      expect(content.style).toBe('default');
      expect(content.tailwind).toBeDefined();
      expect(content.aliases).toBeDefined();
    });

    it('properly handles TypeScript/JavaScript content', async () => {
      const file = await templateFilesFactory.createFromSeed(1); // eslint.config.js
      
      expect(file.content).toContain('import js from "@eslint/js"');
      expect(file.content).toContain('export default tseslint.config');
    });

    it('properly handles HTML content', async () => {
      const file = await templateFilesFactory.createFromSeed(2); // index.html
      
      expect(file.content).toContain('<!DOCTYPE html>');
      expect(file.content).toContain('<div id="root"></div>');
      expect(file.content).toContain('src="/src/main.tsx"');
    });
  });

  describe('Integration', () => {
    it('creates a complete template setup', async () => {
      // Create default template which automatically creates all files
      const template = await templateFactory.createDefault();
      const templateFiles = await TemplateFileModel.all({ templateId: Number(template.id) });
      
      expect(template).toBeDefined();
      expect(template.name).toBe('default');
      expect(templateFiles.length).toEqual(70);
    });

    it('creates multiple templates with different file sets', async () => {
      // Create full template
      const fullTemplate = await templateFactory.createWithFiles(
        { name: 'full' }
      );
      
      // Create minimal template with only 5 files
      const minimalTemplate = await templateFactory.createWithFiles(
        { name: 'minimal' },
        5
      );
      
      expect(fullTemplate.name).toBe('full');
      expect(minimalTemplate.name).toBe('minimal');
    });

    it('creates template with core files only', async () => {
      const template = await templateFactory.create({ 
        name: 'core-only' 
      });
      
      const files = await templateFilesFactory.createCoreFiles(Number(template.id));
      
      expect(template.name).toBe('core-only');
      expect(files.length).toBeGreaterThan(0);
      expect(files.length).toBeLessThan(10);
    });
  });
});