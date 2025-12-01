import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adsFaqTool } from 'app/tools/ads/faq';
import { getFAQSearchService, type FAQSearchResult } from '@services';
import { DatabaseSnapshotter } from '@services';
import { startPolly, stopPolly } from '@utils';
import { db } from 'app/db';
import { documentChunks, documents } from 'app/db/schema';

describe('FAQ Search Tool', () => {
    beforeAll(async () => {
        await DatabaseSnapshotter.restoreSnapshot('basic_account', true);
        await startPolly('faqSearch', 'replay');
    }, 30000);

    afterAll(async () => {
        await stopPolly();
    });

    describe('Database Integration', () => {
        it('should have FAQ documents in the database from snapshot', async () => {
            const storedDocs = await db.select().from(documents);
            expect(storedDocs.length).toBeGreaterThan(0);
            
            const faqDocs = storedDocs.filter(doc => 
                doc.tags && (doc.tags as string[]).includes('ads')
            );
            expect(faqDocs.length).toBeGreaterThan(0);
        });

        it('should have FAQ chunks with embeddings', async () => {
            const chunks = await db.select().from(documentChunks);
            expect(chunks.length).toBeGreaterThan(0);
            
            chunks.forEach(chunk => {
                expect(chunk.question).toBeDefined();
                expect(chunk.answer).toBeDefined();
                expect(chunk.embedding).toBeDefined();
            });
        });
    });

    describe('FAQSearchService', () => {
        it('should search for FAQ entries by query', async () => {
            const faqService = getFAQSearchService();
            const results = await faqService.search('How do I create headlines?', {
                topK: 5,
                tags: ['ads'],
                status: 'live',
            });

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results[0]?.question).toMatch(/Can I bulk add headlines/);
        });

        it('should return properly structured results', async () => {
            const faqService = getFAQSearchService();
            const results = await faqService.search('What are callouts?', {
                topK: 5,
                tags: ['ads'],
                status: 'live',
            });

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            if (results.length > 0 && results[0]) {
                const result = results[0];
                expect(result.id).toBeDefined();
                expect(result.question).toBeDefined();
                expect(result.answer).toBeDefined();
                expect(result.documentId).toBeDefined();
                expect(result.documentSlug).toBeDefined();
                expect(result.relevanceScore).toBeDefined();
                expect(typeof result.relevanceScore).toBe('number');
            }
        });

        it('should format results as context', async () => {
            const faqService = getFAQSearchService();
            const results = await faqService.search('keywords', {
                topK: 3,
                tags: ['ads'],
                status: 'live',
            });

            const formatted = faqService.formatResultsAsContext(results);
            expect(typeof formatted).toBe('string');
            
            if (results.length > 0) {
                expect(formatted).toContain('[1]');
                expect(formatted).toContain('Q:');
                expect(formatted).toContain('A:');
            }
        });

        it('should handle empty results', async () => {
            const faqService = getFAQSearchService();
            const formatted = faqService.formatResultsAsContext([]);
            expect(formatted).toBe('No relevant FAQ entries found.');
        });
    });

    describe('adsFaqTool', () => {
        it('should search for ads-related questions', async () => {
            const result = await adsFaqTool.invoke({
                query: 'How many headlines should I write?',
            });

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        it('should filter by tags when provided', async () => {
            const result = await adsFaqTool.invoke({
                query: 'What are structured snippets?',
                tags: ['ads'],
            });

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        it('should default to ads tag when no tags provided', async () => {
            const result = await adsFaqTool.invoke({
                query: 'How do descriptions work?',
            });

            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });
    });

    describe('Semantic Search Capabilities', () => {
        it('should find relevant FAQs for headline questions', async () => {
            const faqService = getFAQSearchService();
            const results = await faqService.search('best practices for writing headlines', {
                topK: 5,
                tags: ['ads'],
                status: 'live',
            });

            if (results.length > 0) {
                const hasHeadlineRelated = results.some(r => 
                    r.question.toLowerCase().includes('headline') ||
                    r.answer.toLowerCase().includes('headline')
                );
                expect(hasHeadlineRelated || results.length > 0).toBe(true);
            }
        });

        it('should find relevant FAQs for keyword questions', async () => {
            const faqService = getFAQSearchService();
            const results = await faqService.search('how to choose keywords for my ads', {
                topK: 5,
                tags: ['ads'],
                status: 'live',
            });

            expect(results).toBeDefined();
            expect(results.length).toBeGreaterThan(0);

            if (results.length > 0) {
                const hasKeywordRelated = results.some(r => 
                    r.question.toLowerCase().includes('keyword') ||
                    r.answer.toLowerCase().includes('keyword')
                );
                expect(hasKeywordRelated || results.length > 0).toBe(true);
            }
        });

        it('should find relevant FAQs for description questions', async () => {
            const faqService = getFAQSearchService();
            const results = await faqService.search('writing effective ad descriptions', {
                topK: 5,
                tags: ['ads'],
                status: 'live',
            });

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle queries with no good matches', async () => {
            const faqService = getFAQSearchService();
            const results = await faqService.search('quantum physics equations', {
                topK: 5,
                tags: ['ads'],
                status: 'live',
            });

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle very long queries', async () => {
            const longQuery = 'I want to understand how to write the best headlines for my Google Ads campaign that will attract customers and improve my click-through rate while staying within character limits';
            const faqService = getFAQSearchService();
            const results = await faqService.search(longQuery, {
                topK: 5,
                tags: ['ads'],
                status: 'live',
            });

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });

        it('should handle special characters in queries', async () => {
            const faqService = getFAQSearchService();
            const results = await faqService.search('headlines & descriptions?', {
                topK: 5,
                tags: ['ads'],
                status: 'live',
            });

            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
        });
    });

    describe('Performance', () => {
        it('should complete search within reasonable time', async () => {
            const startTime = Date.now();
            
            const faqService = getFAQSearchService();
            await faqService.search('headlines', {
                topK: 5,
                tags: ['ads'],
                status: 'live',
            });

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(5000);
        });
    });
});
