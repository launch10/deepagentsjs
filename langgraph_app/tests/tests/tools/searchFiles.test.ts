import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTools } from '@tools';
import type { GraphState } from '@state';
import type { WebsiteType } from '@types';
import { databaseSnapshotter } from '@services';
import { CodeFileModel } from '@models';

describe('searchFiles Tool', () => {
    let searchFilesTool: any;
    let websiteId: number;
    
    beforeAll(async () => {
        // Restore database snapshot with test data
        await databaseSnapshotter.restoreSnapshot('space_exploration', true);
        
        // For testing, we'll use website ID 1 (should exist in the snapshot)
        websiteId = 2;
        
        const mockState: GraphState = {
            website: {
                id: websiteId,
                name: 'Test Website',
                domain: 'test.com'
            } as WebsiteType
        } as GraphState;
        
        const tools = await initTools(mockState);
        searchFilesTool = tools.searchFiles;
    });

    afterAll(async () => {
        // Clean up database after tests
        await databaseSnapshotter.truncate();
    });

    describe('Single Search Queries', () => {
        it('should perform a basic content search with default settings', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ content: 'benefits' }]
            });

            expect(result.results).toHaveLength(1);
            expect(result.results[0].files).toBeDefined();
            expect(result.results[0].files.length).toBeLessThanOrEqual(2); // Default limit
            expect(result.results[0].query.content).toBe('benefits');
            expect(result.results[0].query.limit).toBe(2);
            expect(result.results[0].error).toBeUndefined();
            if (result.results[0].files.length > 1) {
                expect(result.results[0].files[0].rank).toBeGreaterThanOrEqual(result.results[0].files[1].rank);
            }
        });

        it('should perform a phrase search', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ 
                    content: 'import * as React', 
                    searchMode: 'phrase',
                    limit: 5 
                }]
            });

            expect(result.results[0].query.searchMode).toBe('phrase');
            expect(result.results[0].files.length).toEqual(5);
            expect(result.results[0].error).toBeUndefined();

            for (let i = 1; i < result.results[0].files.length; i++) {
                const thisFile = result.results[0].files[i];
                const prevFile = result.results[0].files[i-1];
                expect(prevFile.rank).toBeGreaterThanOrEqual(thisFile.rank);
            }
        });

        it('should perform a boolean search', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ 
                    content: 'component & ui & !aspect-ratio & !collapsible', 
                    searchMode: 'boolean',
                    limit: 3
                }]
            });

            // Since we fallback to sort order, we can be sure aspect-ratio and collapsible WOULD have been
            // the first results if not for the boolean search
            expect(result.results[0].files.map((f: any) => f.path)).not.toContain('src/components/ui/aspect-ratio.tsx')
            expect(result.results[0].files.map((f: any) => f.path)).not.toContain('src/components/ui/collapsible.tsx')
            expect(result.results[0].query.searchMode).toBe('boolean');
            expect(result.results[0].files.length).toBeLessThanOrEqual(3);
            
            // Verify no test files are included
            const hasTestFile = result.results[0].files.some(
                (f: any) => f.path.includes('test') || f.path.includes('spec')
            );
            expect(hasTestFile).toBe(false);
            
            // Check that results have rank and are sorted by rank
            if (result.results[0].files.length > 1) {
                expect(result.results[0].files[0].rank).toBeGreaterThanOrEqual(result.results[0].files[1].rank);
            }
        });

        it('should perform a path-only search', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ 
                    path: 'component',
                    limit: 10
                }]
            });

            expect(result.results[0].query.path).toBe('component');
            expect(result.results[0].files.length).toBeLessThanOrEqual(10);
            
            // Verify all results have 'component' in the path
            const allHaveComponentInPath = result.results[0].files.every(
                (f: any) => f.path.toLowerCase().includes('component')
            );
            expect(allHaveComponentInPath).toBe(true);
        });

        it('should combine content and path search (filter by path)', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ 
                    content: 'slider | Hero',
                    searchMode: 'boolean',
                    path: 'components',
                    limit: 5
                }]
            });
            expect(result.results[0].files.length).toBeLessThanOrEqual(5);
            
            // Verify files have 'components' in path
            const allInComponentsPath = result.results[0].files.every(
                (f: any) => f.path.toLowerCase().includes('component')
            );
            expect(allInComponentsPath).toBe(true);

            // Verify files have 'slider' OR 'hero' in content
            const allInContent = result.results[0].files.every(
                (f: any) => f.content.toLowerCase().includes('slider') || f.content.toLowerCase().includes('hero')
            );
            expect(allInContent).toBe(true);
        });
    });

    describe('Multiple Parallel Searches', () => {
        it('should execute multiple searches in parallel', async () => {
            const startTime = Date.now();
            
            const result = await searchFilesTool.invoke({
                searches: [
                    { content: 'React', limit: 2 },
                    { content: 'component', limit: 3 },
                    { path: 'pages', limit: 2 }
                ]
            });

            const duration = Date.now() - startTime;
            
            expect(result.results).toHaveLength(3);
            expect(result.results[0].query.content).toBe('React');
            expect(result.results[1].query.content).toBe('component');
            expect(result.results[2].query.path).toBe('pages');
            
            // Should be fast due to parallel execution (under 50ms)
            expect(duration).toBeLessThan(50);
        });

        it('should correctly count unique files across searches', async () => {
            const result = await searchFilesTool.invoke({
                searches: [
                    { content: 'import', limit: 3 },
                    { content: 'export', limit: 3 }
                ]
            });

            expect(result.results).toHaveLength(2);
            
            // Total unique files should be calculated correctly
            const allPaths = new Set<string>();
            result.results.forEach(r => {
                r.files.forEach((f: any) => allPaths.add(f.path));
            });
            expect(result.totalFiles).toBe(allPaths.size);
        });

        it('should handle mixed search types in parallel', async () => {
            const result = await searchFilesTool.invoke({
                searches: [
                    { content: 'function', searchMode: 'plain', limit: 2 },
                    { path: 'src', limit: 2 },
                    { content: 'class & !test', searchMode: 'boolean', limit: 2 }
                ]
            });

            expect(result.results).toHaveLength(3);
            expect(result.results[0].query.searchMode).toBe('plain');
            expect(result.results[2].query.searchMode).toBe('boolean');
        });
    });

    describe('Error Handling', () => {
        it('should handle search without content or path', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ limit: 5 }]
            });

            expect(result.results[0].error).toBe("Must specify either 'content' or 'path' query");
            expect(result.results[0].files).toEqual([]);
        });

        it('should handle invalid boolean syntax gracefully', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ 
                    content: '&& invalid ||', 
                    searchMode: 'boolean' 
                }]
            });

            // Should return an error or empty results
            expect(result.results[0].files.length === 0 || result.results[0].error).toBeTruthy();
        });

        it('should continue with other searches if one fails', async () => {
            const result = await searchFilesTool.invoke({
                searches: [
                    { content: '&& invalid', searchMode: 'boolean' }, // Invalid
                    { content: 'React', limit: 2 } // Valid
                ]
            });

            expect(result.results).toHaveLength(2);
            // First search might fail or return empty
            expect(result.results[0].files.length === 0 || result.results[0].error).toBeTruthy();
            // Second search should work
            expect(result.results[1].files.length).toBeGreaterThan(0);
        });
    });

    describe('Limit Handling', () => {
        it('should respect individual search limits', async () => {
            const result = await searchFilesTool.invoke({
                searches: [
                    { content: 'const', limit: 1 },
                    { content: 'function', limit: 3 },
                    { content: 'import', searchMode: 'plain', limit: 5 }
                ]
            });

            expect(result.results[0].files.length).toBeLessThanOrEqual(1);
            expect(result.results[1].files.length).toBeLessThanOrEqual(3);
            expect(result.results[2].files.length).toBeLessThanOrEqual(5);
        });

        it('should use default limit of 2 when not specified', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ content: 'React' }]
            });

            expect(result.results[0].files.length).toBeLessThanOrEqual(2);
            expect(result.results[0].query.limit).toBe(2);
        });
    });

    describe('Search Modes', () => {
        it('should default to plain search mode', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ content: 'component' }]
            });

            expect(result.results[0].query.searchMode).toBe('plain');
        });

        it('should handle all three search modes', async () => {
            const result = await searchFilesTool.invoke({
                searches: [
                    { content: 'React component', searchMode: 'plain' },
                    { content: 'import React', searchMode: 'phrase' },
                    { content: 'component & !test', searchMode: 'boolean' }
                ]
            });

            expect(result.results[0].query.searchMode).toBe('plain');
            expect(result.results[1].query.searchMode).toBe('phrase');
            expect(result.results[2].query.searchMode).toBe('boolean');
            
            // All should return results or errors, not throw
            result.results.forEach(r => {
                expect(r).toBeDefined();
                expect(Array.isArray(r.files)).toBe(true);
            });
        });
    });

    describe('File Content Validation', () => {
        it('should return files with required fields', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ content: 'React', limit: 1 }]
            });

            if (result.results[0].files.length > 0) {
                const file = result.results[0].files[0];
                expect(file).toHaveProperty('path');
                expect(file).toHaveProperty('content');
                expect(typeof file.path).toBe('string');
                expect(typeof file.content).toBe('string');
            }
        });

        it('should find TypeScript/JavaScript files', async () => {
            const result = await searchFilesTool.invoke({
                searches: [{ 
                    path: '.tsx',
                    limit: 5
                }]
            });

            expect(result.results[0].files.length).toEqual(5);

            if (result.results[0].files.length > 0) {
                const hasTsxFiles = result.results[0].files.some(
                    (f: any) => f.path.endsWith('.tsx') || f.path.endsWith('.ts')
                );
                expect(hasTsxFiles).toBe(true);
            }
        });
    });
});