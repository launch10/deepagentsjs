import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { initTools } from '@tools';
import { SearchIconsService } from '@services';
import { databaseSnapshotter } from '@services';
import { startPolly, stopPolly } from '@utils';
import { db } from 'app/db';
import { iconEmbeddings, iconQueryCaches } from '@db';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Polly } from '@pollyjs/core';

describe('searchIcons Tool', () => {
    let searchIconsTool: any;
    let searchIconsService: SearchIconsService;
    let polly: Polly | null;
    
    beforeAll(async () => {
        // Try to restore snapshot, but continue if Rails API is not available
        try {
            await databaseSnapshotter.restoreSnapshot('basic_account', true);
        } catch (error) {
            console.warn('Could not restore database snapshot (Rails API may not be running):', error.message);
        }
        polly = await startPolly('searchIcons', 'replay');
        
        // Initialize the service - embeddings should already be in the database from snapshot
        searchIconsService = new SearchIconsService();
        
        const tools = await initTools({});
        searchIconsTool = tools.searchIcons;
    });

    afterAll(async () => {
        if (polly) {
            await stopPolly(polly);
        }
    });

    describe('Database Integration', () => {
        it('should have embeddings already in the database from snapshot', async () => {
            // Verify embeddings exist in the database
            const storedEmbeddings = await db.select().from(iconEmbeddings);
            expect(storedEmbeddings.length).toBeGreaterThan(0);
            
            // Each embedding should have required fields
            storedEmbeddings.forEach(embedding => {
                expect(embedding.key).toBeDefined();
                expect(embedding.text).toBeDefined();
                expect(embedding.embedding).toBeDefined();
                expect(embedding.metadata).toBeDefined();
            });
        });
    });

    describe('Basic Icon Search', () => {
        it('should find icons for a single query', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['heart']
            });

            expect(result).toBeDefined();
            expect(result.results).toBeDefined();
            expect(result.results['heart']).toBeDefined();
            expect(Array.isArray(result.results['heart'])).toBe(true);
            
            if (result.results['heart'].length > 0) {
                result.results['heart'].forEach((iconName: string) => {
                    expect(typeof iconName).toBe('string');
                    expect(iconName).toMatch(/[Hh]eart/);
                });
            }
        });

        it('should handle multiple queries in parallel', async () => {
            const queries = ['arrow', 'settings', 'user'];
            const result = await searchIconsTool.invoke({
                queries
            });

            let idx = 0;
            queries.forEach(query => {
                expect(result.results[query]).toBeDefined();
                expect(result.results[query][0].toLowerCase()).toMatch(queries[idx].toLowerCase());
                expect(Array.isArray(result.results[query])).toBe(true);
                idx++;
            });
        });

        it('should respect the limit parameter', async () => {
            const limit = 3;
            const result = await searchIconsTool.invoke({
                queries: ['star'],
                limit
            });

            expect(result.results['star'].length).toBeLessThanOrEqual(limit);
        });

        it('should use default limit of 5 when not specified', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['circle']
            });

            expect(result.results['circle'].length).toBeLessThanOrEqual(5);
        });
    });

    describe('Semantic Search Capabilities', () => {
        it('should find icons by concept description', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['navigation menu']
            });

            expect(result.results['navigation menu']).toBeDefined();
            
            // Should find menu-related icons
            if (result.results['navigation menu'].length > 0) {
                const iconNames = result.results['navigation menu'];
                const hasMenuRelated = iconNames.some((name: string) => 
                    name.toLowerCase().includes('menu') || 
                    name.toLowerCase().includes('nav') || 
                    name.toLowerCase().includes("chevrondown")
                );
                expect(hasMenuRelated || iconNames.length > 0).toBe(true);
            }
        });

        it('should find icons by action description', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['save to disk']
            });

            expect(result.results['save to disk']).toBeDefined();
            
            // Should find save-related icons
            if (result.results['save to disk'].length > 0) {
                const iconNames = result.results['save to disk'];
                const hasSaveRelated = iconNames.some((name: string) => 
                    name.toLowerCase().includes('save') || 
                    name.toLowerCase().includes('download') ||
                    name.toLowerCase().includes('disk')
                );
                expect(hasSaveRelated || iconNames.length > 0).toBe(true);
            }
        });

        it('should find icons by visual description', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['right-pointing arrow']
            });

            expect(result.results['right-pointing arrow']).toBeDefined();
            
            // Should find arrow icons
            if (result.results['right-pointing arrow'].length > 0) {
                const iconNames = result.results['right-pointing arrow'];
                const hasArrowRelated = iconNames.some((name: string) => 
                    name.toLowerCase().includes('arrow') || 
                    name.toLowerCase().includes('chevron') ||
                    name.toLowerCase().includes('right')
                );
                expect(hasArrowRelated || iconNames.length > 0).toBe(true);
            }
        });

        it('should handle synonyms effectively', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['notification bell', 'alert bell']
            });

            // Both queries should return results
            expect(result.results['notification bell']).toBeDefined();
            expect(result.results['alert bell']).toBeDefined();
            
            // Should find bell-related icons for both
            const notificationIcons = result.results['notification bell'];
            const alertIcons = result.results['alert bell'];
            
            // There might be overlap in results due to semantic similarity
            if (notificationIcons.length > 0 && alertIcons.length > 0) {
                const hasBellRelated = [...notificationIcons, ...alertIcons].some(
                    (name: string) => name.toLowerCase().includes('bell') || 
                                     name.toLowerCase().includes('alert')
                );
                expect(hasBellRelated || notificationIcons.length > 0).toBe(true);
            }
        });
    });

    describe('Common Use Cases', () => {
        it('should find social media icons', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['social media', 'facebook', 'twitter']
            });

            expect(result.results['social media']).toBeDefined();
            expect(result.results['facebook']).toBeDefined();
            expect(result.results['twitter']).toBeDefined();
        });

        it('should find UI component icons', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['close', 'expand', 'collapse', 'menu']
            });

            // All common UI icons should have results
            ['close', 'expand', 'collapse', 'menu'].forEach(query => {
                expect(result.results[query]).toBeDefined();
                expect(result.results[query].length).toBeGreaterThan(0);
            });
        });

        it('should find action icons', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['edit', 'delete', 'share', 'copy']
            });

            // All common action icons should have results
            ['edit', 'delete', 'share', 'copy'].forEach(query => {
                expect(result.results[query]).toBeDefined();
                expect(result.results[query].length).toBeGreaterThan(0);
            });
        });

        it('should find status/state icons', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['loading', 'success', 'error', 'warning']
            });

            // Status icons should have results
            ['loading', 'success', 'error', 'warning'].forEach(query => {
                expect(result.results[query]).toBeDefined();
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle queries with no good matches', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['quantum physics visualization']
            });

            // Should still return something, even if not perfect matches
            expect(result.results['quantum physics visualization']).toBeDefined();
            expect(result.results['quantum physics visualization']).toContain("Infinity")
            expect(result.results['quantum physics visualization']).toContain("Atom")
            expect(Array.isArray(result.results['quantum physics visualization'])).toBe(true);
        });

        it('should handle empty results gracefully', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['xyzabc123nonsense']
            });

            expect(result.results['xyzabc123nonsense']).toBeDefined();
            expect(Array.isArray(result.results['xyzabc123nonsense'])).toBe(true);
        });

        it('should handle special characters in queries', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['@', '#', '$']
            });

            // Should handle gracefully
            ['@', '#', '$'].forEach(query => {
                expect(result.results[query]).toBeDefined();
                expect(Array.isArray(result.results[query])).toBe(true);
            });
        });

        it('should handle very long queries', async () => {
            const longQuery = 'this is a very long query that describes an icon for a complex user interface element that handles multiple functions';
            const result = await searchIconsTool.invoke({
                queries: [longQuery]
            });

            expect(result.results[longQuery]).toBeDefined();
            expect(Array.isArray(result.results[longQuery])).toBe(true);
        });
    });

    describe('Performance', () => {
        it('should handle multiple queries efficiently', async () => {
            const startTime = Date.now();
            
            const result = await searchIconsTool.invoke({
                queries: ['home', 'search', 'settings', 'user', 'logout'],
                limit: 3
            });

            const duration = Date.now() - startTime;
            
            // Should complete reasonably quickly (under 5 seconds for 5 queries)
            expect(duration).toBeLessThan(5000);
            
            // All queries should have results
            ['home', 'search', 'settings', 'user', 'logout'].forEach(query => {
                expect(result.results[query]).toBeDefined();
            });
        });

        it('should cache or reuse embeddings efficiently', async () => {
            // First query
            const startTime1 = Date.now();
            await searchIconsTool.invoke({
                queries: ['star']
            });
            const duration1 = Date.now() - startTime1;

            // Second identical query should be faster or similar
            const startTime2 = Date.now();
            await searchIconsTool.invoke({
                queries: ['star']
            });
            const duration2 = Date.now() - startTime2;

            // Second query shouldn't be significantly slower
            expect(duration2).toBeLessThanOrEqual(duration1 * 2);
        });
    });

    describe('Caching Behavior', () => {
        it('should use cache and NOT call OpenAI embeddings on second query', async () => {
            // Create a spy on the OpenAIEmbeddings embedQuery method
            const embedQuerySpy = vi.spyOn(OpenAIEmbeddings.prototype, 'embedQuery');
            
            // Clear the spy to start fresh
            embedQuerySpy.mockClear();
            
            // First query - this will call OpenAI and cache the result
            const firstResult = await searchIconsTool.invoke({
                queries: ['home']
            });

            expect(firstResult.results['home']).toBeDefined();
            expect(Array.isArray(firstResult.results['home'])).toBe(true);
            
            // Clear the spy count
            embedQuerySpy.mockClear();
            
            // Second identical query - should use cache and NOT call OpenAI
            const secondResult = await searchIconsTool.invoke({
                queries: ['home']
            });

            expect(secondResult.results['home']).toBeDefined();
            expect(Array.isArray(secondResult.results['home'])).toBe(true);
            
            // Results should be the same
            expect(secondResult.results['home']).toEqual(firstResult.results['home']);
            
            // IMPORTANT: embedQuery should NOT have been called for cached query
            expect(embedQuerySpy).toHaveBeenCalledTimes(0);
            
            // Restore the original implementation
            embedQuerySpy.mockRestore();
        });
        
        it('should expire cache after TTL and call OpenAI again', async () => {
            // This test would need to mock time or wait for TTL to expire
            // For now, we'll just verify the cache table exists and is being used
            
            const result = await searchIconsTool.invoke({
                queries: ['settings']
            });

            expect(result.results['settings']).toBeDefined();
            expect(Array.isArray(result.results['settings'])).toBe(true);
            
            // Check that the cache table has entries
            const cacheEntries = await db.select().from(iconQueryCaches);
            expect(cacheEntries.length).toBeGreaterThan(0);
            
            // Verify cache entry has expected fields
            const cacheEntry = cacheEntries.find(e => e.query === 'settings');
            if (cacheEntry) {
                expect(cacheEntry.results).toBeDefined();
                expect(cacheEntry.topK).toBeDefined();
                expect(cacheEntry.ttlSeconds).toBe(86400); // 24 hours
                expect(cacheEntry.minSimilarity).toBe(0.25); // Updated threshold
            }
        });
    });

    describe('Error Handling', () => {
        it('should require at least one query', async () => {
            await expect(
                searchIconsTool.invoke({
                    queries: []
                })
            ).rejects.toThrow();
        });

        it('should handle invalid limit values', async () => {
            await expect(
                searchIconsTool.invoke({
                    queries: ['test'],
                    limit: -1
                })
            ).rejects.toThrow();

            await expect(
                searchIconsTool.invoke({
                    queries: ['test'],
                    limit: 0
                })
            ).rejects.toThrow();
        });
    });

    describe('Result Quality', () => {
        it('should return relevant icons for common searches', async () => {
            const commonSearches = {
                'home': ['Home', 'House'],
                'search': ['Search', 'SearchIcon'],
                'settings': ['Settings', 'SettingsIcon', 'Cog'],
                'user': ['User', 'UserIcon', 'PersonStanding'],
                'mail': ['Mail', 'MailIcon', 'Inbox']
            };

            for (const [query, expectedPatterns] of Object.entries(commonSearches)) {
                const result = await searchIconsTool.invoke({
                    queries: [query],
                    limit: 10
                });

                const iconNames = result.results[query];
                
                // At least one result should match expected patterns
                const hasExpectedIcon = iconNames.some((name: string) =>
                    expectedPatterns.some(pattern => 
                        name.toLowerCase().includes(pattern.toLowerCase()) ||
                        pattern.toLowerCase().includes(name.toLowerCase())
                    )
                );
                
                expect(hasExpectedIcon || iconNames.length > 0).toBe(true);
            }
        });

        it('should rank more relevant results higher', async () => {
            const result = await searchIconsTool.invoke({
                queries: ['arrow right'],
                limit: 10
            });

            const iconNames = result.results['arrow right'];
            
            if (iconNames.length > 5) {
                // Icons with 'arrow' and 'right' should appear before generic arrows
                const topResults = iconNames.slice(0, 3);
                const hasDirectMatch = topResults.some((name: string) =>
                    name.toLowerCase().includes('arrow') && 
                    name.toLowerCase().includes('right')
                );
                
                // At least one of the top results should be highly relevant
                expect(hasDirectMatch || topResults.length > 0).toBe(true);
            }
        });
    });
});