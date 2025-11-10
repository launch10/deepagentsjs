import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initWebsiteTools } from 'app/tools/website';
import type { WebsiteGraphState} from '@state';
import type { WebsiteType } from '@types';
import { databaseSnapshotter } from '@services';

describe('listFiles Tool', () => {
    let listFilesTool: any;
    let websiteId: number;
    
    beforeAll(async () => {
        await databaseSnapshotter.restoreSnapshot('space_exploration', true);

        // For testing, we'll use website ID 1
        websiteId = 2;
        
        const mockState: WebsiteGraphState= {
            website: {
                id: websiteId,
                name: 'Test Website',
                domain: 'test.com'
            } as WebsiteType
        } as GraphState;
        
        const { listFiles } = await initWebsiteTools(mockState);
        listFilesTool = listFiles;
    });

    afterAll(async () => {
        await databaseSnapshotter.truncate();
    });

    describe('Basic Pattern Matching', () => {
        it('should list files matching a simple pattern', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'component'
            });

            expect(result.files).toBeDefined();
            expect(Array.isArray(result.files)).toBe(true);
            expect(result.totalMatches).toBeGreaterThanOrEqual(0);
            expect(result.truncated).toBeDefined();
            
            // All results should have 'component' in the path
            result.files.forEach((file: any) => {
                expect(file.path.toLowerCase()).toContain('component');
            });
        });

        it('should find files by extension', async () => {
            const result = await listFilesTool.invoke({
                pattern: '.tsx'
            });

            expect(result.files.length).toBeGreaterThan(0);
            
            // All results should end with .tsx
            result.files.forEach((file: any) => {
                expect(file.path).toContain('.tsx');
            });
        });

        it('should find files in specific directories', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'pages/'
            });

            if (result.files.length > 0) {
                result.files.forEach((file: any) => {
                    expect(file.path).toContain('pages/');
                });
            }
        });

        it('should handle patterns with multiple parts', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'src/components'
            });

            if (result.files.length > 0) {
                result.files.forEach((file: any) => {
                    expect(file.path.toLowerCase()).toContain('component');
                });
            }
        });
    });

    describe('Limit Handling', () => {
        it('should respect the limit parameter', async () => {
            const customLimit = 3;
            const result = await listFilesTool.invoke({
                pattern: '.',  // Match any file with extension
                limit: customLimit
            });

            expect(result.files.length).toBeLessThanOrEqual(customLimit);
            expect(result.totalMatches).toBeLessThanOrEqual(customLimit);
        });

        it('should use default limit of 100 when not specified', async () => {
            const result = await listFilesTool.invoke({
                pattern: '.'  // Match any file with extension
            });

            expect(result.files.length).toBeLessThanOrEqual(100);
        });

        it('should indicate truncation when results exceed limit', async () => {
            const result = await listFilesTool.invoke({
                pattern: '.',  // Likely to match many files
                limit: 1
            });

            if (result.totalMatches === 1) {
                // Might be truncated or might genuinely have only 1 match
                expect(result.truncated).toBeDefined();
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle patterns with no matches', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'definitely_not_a_real_file_pattern_xyz123'
            });

            expect(result.files).toEqual([]);
            expect(result.totalMatches).toBe(0);
            expect(result.truncated).toBe(false);
        });

        it('should handle single character patterns', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'a'
            });

            // Should find files with 'a' in the path
            if (result.files.length > 0) {
                result.files.forEach((file: any) => {
                    expect(file.path.toLowerCase()).toContain('a');
                });
            }
        });

        it('should handle special characters in patterns', async () => {
            const result = await listFilesTool.invoke({
                pattern: '@'  // Might match @types or similar
            });

            // Should handle gracefully even if no matches
            expect(result).toBeDefined();
            expect(Array.isArray(result.files)).toBe(true);
        });
    });

    describe('Performance', () => {
        it('should be fast for path-only queries', async () => {
            const startTime = Date.now();
            
            const result = await listFilesTool.invoke({
                pattern: 'component',
                limit: 20
            });

            const duration = Date.now() - startTime;
            
            // Path-only queries should be very fast (under 1 second)
            expect(duration).toBeLessThan(1000);
            expect(result.files).toBeDefined();
        });

        it('should handle large result sets efficiently', async () => {
            const result = await listFilesTool.invoke({
                pattern: '.',  // Match all files with extensions
                limit: 50
            });

            expect(result.files.length).toBeLessThanOrEqual(50);
            expect(result.totalMatches).toBeLessThanOrEqual(50);
        });
    });

    describe('Common Use Cases', () => {
        it('should find all TypeScript files', async () => {
            const result = await listFilesTool.invoke({
                pattern: '.ts'
            });

            if (result.files.length > 0) {
                result.files.forEach((file: any) => {
                    expect(
                        file.path.endsWith('.ts') || 
                        file.path.endsWith('.tsx')
                    ).toBe(true);
                });
            }
        });

        it('should find all test files', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'test'
            });

            if (result.files.length > 0) {
                result.files.forEach((file: any) => {
                    expect(file.path.toLowerCase()).toContain('test');
                });
            }
        });

        it('should find configuration files', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'config'
            });

            if (result.files.length > 0) {
                result.files.forEach((file: any) => {
                    expect(file.path.toLowerCase()).toContain('config');
                });
            }
        });

        it('should find JSON files', async () => {
            const result = await listFilesTool.invoke({
                pattern: '.json'
            });

            if (result.files.length > 0) {
                result.files.forEach((file: any) => {
                    expect(file.path).toContain('.json');
                });
            }
        });
    });

    describe('Tree View Mode', () => {
        it('should return tree structure when view is set to tree', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'component',
                view: 'tree',
                limit: 10
            });

            expect(result.view).toBe('tree');
            expect(result.tree).toBeDefined();
            expect(result.tree.name).toBe('.');
            expect(result.tree.type).toBe('directory');
            expect(result.formattedOutput).toContain('📁');
            expect(result.formattedOutput).toContain('📄');
            expect(result.files).toBeUndefined(); // Files not included in tree view
        });

        it('should return list structure when view is set to list', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'component',
                view: 'list',
                limit: 10
            });

            expect(result.view).toBe('list');
            expect(result.files).toBeDefined();
            expect(result.tree).toBeUndefined();
            expect(result.formattedOutput).toContain('•');
        });

        it('should default to list view when not specified', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'test'
            });

            expect(result.view).toBe('list');
            expect(result.files).toBeDefined();
            expect(result.tree).toBeUndefined();
        });

        it('should properly nest directories in tree view', async () => {
            const result = await listFilesTool.invoke({
                pattern: '/',  // Match files with directories
                view: 'tree',
                limit: 20
            });

            if (result.tree && result.tree.children && result.tree.children.length > 0) {
                // Check that directories come before files
                const dirs = result.tree.children.filter(c => c.type === 'directory');
                const files = result.tree.children.filter(c => c.type === 'file');
                const dirIndex = dirs.length > 0 ? result.tree.children.indexOf(dirs[0]) : -1;
                const fileIndex = files.length > 0 ? result.tree.children.indexOf(files[0]) : -1;
                
                if (dirIndex !== -1 && fileIndex !== -1) {
                    expect(dirIndex).toBeLessThan(fileIndex);
                }
            }
        });

        it('should format tree output correctly', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'src',
                view: 'tree',
                limit: 5
            });

            if (result.totalMatches > 0) {
                expect(result.formattedOutput).toContain('Found');
                expect(result.formattedOutput).toContain('file(s) matching');
                
                // Check for tree formatting characters
                if (result.tree.children && result.tree.children.length > 1) {
                    expect(result.formattedOutput).toMatch(/[├└]/); // Tree connectors
                }
            }
        });

        it('should handle truncation message in tree view', async () => {
            const result = await listFilesTool.invoke({
                pattern: '.',
                view: 'tree',
                limit: 2
            });

            if (result.truncated) {
                expect(result.formattedOutput).toContain('more file(s)');
                expect(result.formattedOutput).toContain('truncated at limit');
            }
        });

        it('should handle empty results in tree view', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'definitely_not_existing_pattern_xyz',
                view: 'tree'
            });

            expect(result.tree).toBeDefined();
            expect(result.tree.name).toBe('.');
            expect(result.tree.children).toEqual([]);
            expect(result.totalMatches).toBe(0);
        });
    });

    describe('Formatted Output', () => {
        it('should provide formatted output for list view', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'test',
                view: 'list',
                limit: 5
            });

            expect(result.formattedOutput).toBeDefined();
            expect(typeof result.formattedOutput).toBe('string');
            
            if (result.files.length > 0) {
                // Check that all files appear in the formatted output
                result.files.forEach((file: any) => {
                    expect(result.formattedOutput).toContain(file.path);
                });
            }
        });

        it('should provide formatted output for tree view', async () => {
            const result = await listFilesTool.invoke({
                pattern: 'component',
                view: 'tree',
                limit: 10
            });

            expect(result.formattedOutput).toBeDefined();
            expect(typeof result.formattedOutput).toBe('string');
            
            if (result.totalMatches > 0) {
                expect(result.formattedOutput.length).toBeGreaterThan(0);
            }
        });

        it('should format error messages properly', async () => {
            // This would need a way to trigger an error, perhaps with mocking
            // For now, we just ensure the output format is always defined
            const result = await listFilesTool.invoke({
                pattern: 'test'
            });

            expect(result.formattedOutput).toBeDefined();
            expect(typeof result.formattedOutput).toBe('string');
        });
    });
});