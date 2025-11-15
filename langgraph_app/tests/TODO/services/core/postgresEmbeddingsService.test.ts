import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { PostgresEmbeddingsService, type PgCacheTable, type CacheOptions } from '@services';
import { iconEmbeddings, db } from '@db';
import { startPolly, stopPolly } from '@utils';

describe('PostgresEmbeddingsService - Generic Caching', () => {
    let service: PostgresEmbeddingsService;
    let mockCacheTable: PgCacheTable;
    
    beforeAll(async () => {
        // Start Polly for HTTP recording/replay of OpenAI calls
        startPolly(
            'postgresEmbeddingsService',
            'replay'
        );
    });
    
    afterAll(async () => {
        await stopPolly();
    });
    
    beforeEach(() => {
        // Create a mock cache table that follows the PgCacheTable interface
        mockCacheTable = {
            id: {} as any,
            query: {} as any,
            results: {} as any,
            topK: {} as any,
            ttlSeconds: {} as any,
            createdAt: {} as any,
            lastUsedAt: {} as any,
            useCount: {} as any,
            minSimilarity: {} as any,
            $_: {} as any,
            [Symbol.for('drizzle:Name')]: 'mock_cache_table' as any,
            [Symbol.for('drizzle:Schema')]: undefined as any,
            [Symbol.for('drizzle:IsAlias')]: false as any,
            [Symbol.for('drizzle:Columns')]: {} as any,
            [Symbol.for('drizzle:OriginalName')]: 'mock_cache_table' as any,
            [Symbol.for('drizzle:BaseName')]: 'mock_cache_table' as any,
            [Symbol.for('drizzle:ExtraConfigBuilder')]: undefined as any
        } as PgCacheTable;
    });
    
    describe('Cache Configuration', () => {
        it('should initialize without a cache table', () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings
            });
            
            expect(service).toBeDefined();
        });
        
        it('should initialize with a cache table', () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings,
                cacheTable: mockCacheTable
            });
            
            expect(service).toBeDefined();
        });
    });
    
    describe('checkCache Method', () => {
        it('should return null when no cache table is configured', async () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings
            });
            
            const result = await service.checkCache('test query', 5);
            expect(result).toBeNull();
        });
        
        it('should query the cache table when configured', async () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings,
                cacheTable: mockCacheTable
            });
            
            // Mock the database select
            const mockSelect = vi.spyOn(db, 'select').mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            } as any);
            
            const result = await service.checkCache('test query', 5);
            
            expect(mockSelect).toHaveBeenCalled();
            expect(result).toBeNull(); // No cached results
            
            mockSelect.mockRestore();
        });
        
        it('should handle expired cache entries', async () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings,
                cacheTable: mockCacheTable
            });
            
            const expiredDate = new Date();
            expiredDate.setHours(expiredDate.getHours() - 25); // Expired 25 hours ago
            
            // Mock expired cache entry
            const mockSelect = vi.spyOn(db, 'select').mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([{
                                id: '1',
                                query: 'test query',
                                results: JSON.stringify([{ key: 'test', similarity: 0.9 }]),
                                topK: 10,
                                ttlSeconds: 86400, // 24 hours
                                lastUsedAt: expiredDate,
                                useCount: 1
                            }])
                        })
                    })
                })
            } as any);
            
            const mockDelete = vi.spyOn(db, 'delete').mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined)
                })
            } as any);
            
            const result = await service.checkCache('test query', 5);
            
            expect(mockDelete).toHaveBeenCalled();
            expect(result).toBeNull();
            
            mockSelect.mockRestore();
            mockDelete.mockRestore();
        });
        
        it('should return cached results when valid', async () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings,
                cacheTable: mockCacheTable
            });
            
            const recentDate = new Date();
            const cachedResults = [
                { key: 'icon1', text: 'test', similarity: 0.9, metadata: {} },
                { key: 'icon2', text: 'test2', similarity: 0.8, metadata: {} }
            ];
            
            // Mock valid cache entry
            const mockSelect = vi.spyOn(db, 'select').mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockReturnValue({
                            limit: vi.fn().mockResolvedValue([{
                                id: '1',
                                query: 'test query',
                                results: cachedResults,
                                topK: 10,
                                ttlSeconds: 86400, // 24 hours
                                lastUsedAt: recentDate,
                                useCount: 1
                            }])
                        })
                    })
                })
            } as any);
            
            const mockUpdate = vi.spyOn(db, 'update').mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined)
                })
            } as any);
            
            const result = await service.checkCache('test query', 2);
            
            expect(mockUpdate).toHaveBeenCalled();
            expect(result).toEqual(cachedResults.slice(0, 2));
            
            mockSelect.mockRestore();
            mockUpdate.mockRestore();
        });
    });
    
    describe('cacheResults Method', () => {
        it('should not cache when no cache table is configured', async () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings
            });
            
            const mockInsert = vi.spyOn(db, 'insert');
            
            await service.cacheResults('test', [], 5);
            
            expect(mockInsert).not.toHaveBeenCalled();
            
            mockInsert.mockRestore();
        });
        
        it('should cache results when cache table is configured', async () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings,
                cacheTable: mockCacheTable
            });
            
            const results = [
                { key: 'icon1', text: 'test', similarity: 0.9, metadata: {} },
                { key: 'icon2', text: 'test2', similarity: 0.8, metadata: {} }
            ];
            
            const mockInsert = vi.spyOn(db, 'insert').mockReturnValue({
                values: vi.fn().mockReturnValue({
                    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined)
                })
            } as any);
            
            await service.cacheResults('test query', results, 5, {
                ttlSeconds: 3600,
                minSimilarity: 0.7
            });
            
            expect(mockInsert).toHaveBeenCalledWith(mockCacheTable);
            
            mockInsert.mockRestore();
        });
        
        it('should not cache results below minimum similarity threshold', async () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings,
                cacheTable: mockCacheTable
            });
            
            const results = [
                { key: 'icon1', text: 'test', similarity: 0.5, metadata: {} },
                { key: 'icon2', text: 'test2', similarity: 0.4, metadata: {} }
            ];
            
            const mockInsert = vi.spyOn(db, 'insert');
            
            await service.cacheResults('test query', results, 5, {
                minSimilarity: 0.7
            });
            
            expect(mockInsert).not.toHaveBeenCalled();
            
            mockInsert.mockRestore();
        });
    });
    
    describe('Cache Options in Search', () => {
        it('should use cache when enableCache is true', async () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings,
                cacheTable: mockCacheTable
            });
            
            const checkCacheSpy = vi.spyOn(service, 'checkCache').mockResolvedValue([
                { key: 'cached', text: 'cached result', similarity: 0.95, metadata: {} }
            ]);
            
            const result = await service.search('test', 5, { enableCache: true });
            
            expect(checkCacheSpy).toHaveBeenCalledWith('test', 5);
            expect(result).toEqual([
                { key: 'cached', text: 'cached result', similarity: 0.95, metadata: {} }
            ]);
            
            checkCacheSpy.mockRestore();
        });
        
        it('should skip cache when enableCache is false', async () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings,
                cacheTable: mockCacheTable
            });
            
            const checkCacheSpy = vi.spyOn(service, 'checkCache');
            
            // Mock the database operations for search
            vi.spyOn(db, 'select').mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    }),
                    orderBy: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            } as any);
            
            await service.search('test', 5, { enableCache: false });
            
            expect(checkCacheSpy).not.toHaveBeenCalled();
            
            checkCacheSpy.mockRestore();
        });
        
        it('should cache results after search when cache is enabled', async () => {
            service = new PostgresEmbeddingsService({
                db,
                table: iconEmbeddings,
                cacheTable: mockCacheTable
            });
            
            const cacheResultsSpy = vi.spyOn(service, 'cacheResults').mockResolvedValue(undefined);
            vi.spyOn(service, 'checkCache').mockResolvedValue(null); // No cache hit
            
            // Mock the database operations for search
            vi.spyOn(db, 'select').mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    }),
                    orderBy: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([])
                    })
                })
            } as any);
            
            const options: CacheOptions = {
                enableCache: true,
                ttlSeconds: 7200,
                minSimilarity: 0.8
            };
            
            await service.search('test', 5, options);
            
            expect(cacheResultsSpy).toHaveBeenCalledWith('test', [], 5, options);
            
            cacheResultsSpy.mockRestore();
        });
    });
});