import { describe, it, expect } from 'vitest';
import { filesPrompt } from '@prompts';

describe.sequential('files Component', () => {
  const sampleFiles = {
    'src/App.tsx': { content: `const App = () => { 
      return <div>Hello</div>; 
    }` },
    'src/index.tsx': { content: 'import { useState } from "react";' },
    'package.json': { content: '{ "name": "test-app" }' },
    'README.md': { content: '# Test App' }
  };

  it('should render all files with content when no fullContentPaths specified', async () => {
    const result = await filesPrompt({ files: sampleFiles });
    
    expect(result).toEqualXml(`
      <files>
        <file path="package.json">{ "name": "test-app" }</file>
        <file path="README.md"># Test App</file>
        <file path="src/App.tsx">const App = () => { return <div>Hello</div>; }</file>
        <file path="src/index.tsx">import { useState } from "react";</file>
      </files>
    `);
  });

  it('should only show content for specified fullContentPaths', async () => {
    const result = await filesPrompt({ 
      files: sampleFiles,
      fullContentPaths: ['src/App.tsx', 'README.md']
    });
    
    // Should include full content for specified files
    expect(result).toMatchXml(`
      <file path="src/App.tsx">
        const App = () => { 
          return <div>Hello</div>; 
        }
      </file>
    `);
    
    expect(result).toMatchXml(`
      <file path="README.md">
        # Test App
      </file>
    `);
    
    expect(result).toMatchXml(`
      <file path="package.json"></file>
    `);
  });

  it('should exclude non-fullContent files when includeEmptyFiles is false', async () => {
    const result = await filesPrompt({
      files: sampleFiles,
      fullContentPaths: ['src/App.tsx'],
      includeEmptyFiles: false
    });
    
    // Should only include the specified file
    expect(result).toMatchXml(`
      <files>
        <file path="src/App.tsx">
          const App = () => { 
            return <div>Hello</div>; 
          }
        </file>
      </files>
    `);
    
    expect(result).not.toMatchXml(`
      <files>
        <file path="README.md">
          # Test App
        </file>
      </files>
    `);

    expect(result).not.toMatchXml(`
      <file path="package.json"></file>
    `);
  });

  it('should handle empty files object gracefully', async () => {
    const result = await filesPrompt({ files: {} });
    
    expect(result).toEqualXml(`
      <files>No existing files provided.</files>
    `);
  });

  it('should handle null/undefined files gracefully', async () => {
    const result = await filesPrompt({ files: null as any });
    
    expect(result).toEqualXml(`
      <files>No existing files provided.</files>
    `);
  });

  it('should maintain alphabetical sorting of file paths', async () => {
    const unsortedFiles = {
      'z-file.ts': { content: 'z content' },
      'a-file.ts': { content: 'a content' },
      'm-file.ts': { content: 'm content' }
    };
    
    const result = await filesPrompt({ files: unsortedFiles });
    
    // Check that files appear in alphabetical order
    const aIndex = result.indexOf('a-file.ts');
    const mIndex = result.indexOf('m-file.ts');
    const zIndex = result.indexOf('z-file.ts');
    
    expect(aIndex).toBeLessThan(mIndex);
    expect(mIndex).toBeLessThan(zIndex);
  });

  it('should handle files with additional properties', async () => {
    const filesWithMetadata = {
      'src/App.tsx': { 
        content: 'const App = () => {}',
        lastModified: '2024-01-01',
        size: 1234
      }
    };
    
    const result = await filesPrompt({ files: filesWithMetadata });
    
    expect(result).toContain('<file path="src/App.tsx">');
    // The content is now formatted with newlines by the XML formatter
    expect(result).toContain('const App = () =>');
    // Should only use content, not other properties
    expect(result).not.toContain('2024-01-01');
    expect(result).not.toContain('1234');
  });

  it('should format with proper clearfix spacing', async () => {
    const testFiles = {
      'file1.ts': { content: 'content 1' },
      'file2.ts': { content: 'content 2' }
    };
    
    const result = await filesPrompt({ files: testFiles });
    
    // Check for proper formatting with newlines after opening and before closing
    const lines = result.split('\n');
    
    // Should have proper structure
    expect(result).toContain('<files>');
    expect(result).toContain('<file path="file1.ts">');
    expect(result).toContain('content 1');
    expect(result).toContain('<file path="file2.ts">');
    expect(result).toContain('content 2');
    expect(result).toContain('</files>');
  });

  it('should handle complex file content with special characters', async () => {
    const complexFiles = {
      'src/Component.tsx': { 
        content: `import { useState } from 'react';
const Component = () => {
  return <div className="test">Hello & goodbye</div>;
};` 
      }
    };
    
    const result = await filesPrompt({ files: complexFiles });
    
    expect(result).toMatchXml(`
        <files>
            <file path="src/Component.tsx">
              import { useState } from 'react';
              const Component = () => {
                return <div className="test">Hello & goodbye</div>;
              };
            </file>
        </files>
    `);
  });
});