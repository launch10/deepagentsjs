import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { openai } from "@ai-sdk/openai";
import { eq, gte, ilike, sql, and, or, getTableName, desc } from "drizzle-orm";
import type { DB } from "app/db";
import { env } from "@app";

import {
  pgTable,
  type PgColumn,
  type PgTableFn,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { type AnyPgTable } from "drizzle-orm/pg-core";

export interface PgTableWithEmbeddingColumns extends AnyPgTable {
  key: PgColumn<any, any, any>;
  text: PgColumn<any, any, any>;
  metadata: PgColumn<any, any, any>;
  embedding: PgColumn<any, any, any>;
}

export type PgEmbeddingTable = PgTableWithEmbeddingColumns;

export interface PgTableWithCacheColumns extends AnyPgTable {
  id: PgColumn<any, any, any>;
  query: PgColumn<any, any, any>;
  results: PgColumn<any, any, any>;
  topK: PgColumn<any, any, any>;
  ttlSeconds: PgColumn<any, any, any>;
  lastUsedAt: PgColumn<any, any, any>;
  createdAt: PgColumn<any, any, any>;
  updatedAt: PgColumn<any, any, any>;
  useCount: PgColumn<any, any, any>;
  minSimilarity: PgColumn<any, any, any>;
}

export type PgCacheTable = PgTableWithCacheColumns;

export interface Embedding {
  key: string;
  text: string;
  embedding?: number[];
  metadata: any;
}

export interface EmbeddingResult extends Embedding {
  similarity: number;
}

export interface CacheOptions {
  ttlSeconds?: number;
  minSimilarity?: number;
  enableCache?: boolean;
}

const getPostgresUrl = (): string => {
  const postgresUrl = env.DATABASE_URL;
  if (!postgresUrl) {
    throw new Error("DATABASE_URL is missing!");
  }
  return postgresUrl;
};

/**
 * Generic PostgreSQL Embeddings Service using LangChain's PGVector
 */
export class PostgresEmbeddingsService {
  private vectorStore: PGVectorStore;
  private table: PgEmbeddingTable;
  private tableName: string;
  private embeddingModel: OpenAIEmbeddings;
  private db: DB;

  private readonly DEFAULT_TTL_SECONDS = 86400; // 24 hours
  private readonly DEFAULT_MIN_SIMILARITY = 0.25; // Lowered to cache more results

  private cacheTable?: PgCacheTable;

  constructor({
    db,
    table,
    cacheTable,
    dimensions = 1536,
    embeddingModel = openai.embedding("text-embedding-3-small"),
  }: {
    db: DB;
    table: PgEmbeddingTable;
    cacheTable?: PgCacheTable;
    dimensions?: number;
    embeddingModel?: any;
  }) {
    this.db = db;
    this.table = table;
    this.cacheTable = cacheTable;
    this.tableName = getTableName(table);
    this.embeddingModel = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-3-small",
    });

    // Initialize PGVector store
    this.vectorStore = new PGVectorStore(this.embeddingModel, {
      postgresConnectionOptions: {
        connectionString: getPostgresUrl(),
      },
      tableName: this.tableName,
      columns: {
        idColumnName: "key",
        vectorColumnName: "embedding",
        contentColumnName: "text",
        metadataColumnName: "metadata",
      },
      filter: {
        // Ensure key is properly handled during upserts
        whereClause: (key: string) => `key = '${key}'`,
        columnName: "key",
      },
    });
  }

  /**
   * Store embeddings for a collection of items
   */
  async storeEmbeddings(items: Embedding[], forceRegenerate: boolean = false) {
    try {
      // Convert items to LangChain Documents
      const documents = items.map((item) => {
        if (!item.key) {
          throw new Error(`Missing key for item: ${JSON.stringify(item)}`);
        }
        return new Document({
          pageContent: item.text,
          metadata: {
            ...item.metadata,
            key: item.key, // Ensure key is in metadata
          },
        });
      });

      // Store documents in vector store with explicit IDs
      await this.vectorStore.addDocuments(documents, {
        ids: items.map((item) => item.key),
      });

      console.log(`Stored ${items.length} embeddings in ${this.tableName}`);
      return documents;
    } catch (error) {
      console.error(`Error storing embeddings in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Check if we have a valid cached result for the query
   */
  async checkCache(
    query: string,
    requestedTopK: number
  ): Promise<EmbeddingResult[] | null> {
    if (!this.cacheTable) {
      console.log("No cache table configured");
      return null;
    }

    console.log(
      `Checking cache for query: "${query.toLowerCase()}", topK: ${requestedTopK}`
    );

    const cachedResults = await this.db
      .select()
      .from(this.cacheTable)
      .where(
        and(
          eq(this.cacheTable.query, query.toLowerCase()),
          gte(this.cacheTable.topK, requestedTopK)
        )
      )
      .orderBy(desc(this.cacheTable.lastUsedAt))
      .limit(1);

    console.log(`Found ${cachedResults.length} cached results`);

    if (cachedResults.length === 0) {
      return null;
    }

    const cached = cachedResults[0];

    const now = new Date();
    const expiresAt = new Date(cached.lastUsedAt);
    expiresAt.setSeconds(expiresAt.getSeconds() + cached.ttlSeconds);

    // Check if cache has expired
    if (now > expiresAt) {
      await this.db
        .delete(this.cacheTable)
        .where(eq(this.cacheTable.id, cached.id));
      return null;
    }

    // Update last used time and increment use count
    await this.db
      .update(this.cacheTable)
      .set({
        lastUsedAt: now.toISOString(),
        useCount: sql`${this.cacheTable.useCount} + 1`,
      })
      .where(eq(this.cacheTable.id, cached.id));

    // If we need fewer results than cached, return only what was requested
    const results = cached.results as EmbeddingResult[];
    return results.slice(0, requestedTopK);
  }

  /**
   * Cache search results if they meet the minimum similarity threshold
   */
  async cacheResults(
    query: string,
    results: EmbeddingResult[],
    topK: number,
    options?: CacheOptions
  ) {
    if (!this.cacheTable) {
      console.log("No cache table configured for caching");
      return;
    }

    const ttlSeconds = options?.ttlSeconds || this.DEFAULT_TTL_SECONDS;
    const minSimilarity = options?.minSimilarity || this.DEFAULT_MIN_SIMILARITY;

    // Only cache if we have results and they meet the minimum similarity threshold
    if (
      results.length > 0 &&
      results.every((r) => r.similarity >= minSimilarity)
    ) {
      const now = new Date().toISOString();
      const queryLower = query.toLowerCase();

      // Check if cache entry already exists
      const existing = await this.db
        .select()
        .from(this.cacheTable)
        .where(eq(this.cacheTable.query, queryLower))
        .limit(1);

      if (existing.length > 0) {
        // Update existing cache entry
        await this.db
          .update(this.cacheTable)
          .set({
            results: results,
            topK,
            ttlSeconds,
            minSimilarity,
            updatedAt: now,
            lastUsedAt: now,
            useCount: sql`${this.cacheTable.useCount} + 1`,
          })
          .where(eq(this.cacheTable.query, queryLower));
        console.log(`✅ Updated cache for query: "${queryLower}"`);
      } else {
        // Insert new cache entry
        await this.db.insert(this.cacheTable).values({
          query: queryLower,
          results: results,
          topK,
          ttlSeconds,
          minSimilarity,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: now,
          useCount: 1,
        });
        console.log(`✅ Created new cache entry for query: "${queryLower}"`);
      }
    } else {
      console.log(`❌ Not caching - results don't meet criteria`);
    }
  }

  // Helper function to calculate cosine similarity between two vectors
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (
      !vecA ||
      !vecB ||
      vecA.length === 0 ||
      vecB.length === 0 ||
      vecA.length !== vecB.length
    ) {
      return -1; // Indicates dissimilarity or invalid input
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0; // One or both vectors are zero vectors
    }

    return dotProduct / (normA * normB); // Cosine similarity (-1 to 1)
  }

  /**
   * Search for similar items using vector similarity
   */
  async search(
    query: string,
    topK: number = 5,
    options?: CacheOptions
  ): Promise<EmbeddingResult[]> {
    try {
      // Check cache first if enabled
      if (options?.enableCache !== false && this.cacheTable) {
        const cachedResults = await this.checkCache(query, topK);
        if (cachedResults) {
          console.log(`Cache hit for query: ${query}`);
          return cachedResults;
        }
      }

      let results: EmbeddingResult[] = [];

      // Get query embedding
      const queryEmbedding = await this.vectorStore.embeddings.embedQuery(
        query
      );

      // Try exact text match using ILIKE, also fetch embedding
      const exactMatchesData = await this.db
        .select({
          key: this.table.key,
          text: this.table.text,
          metadata: this.table.metadata,
          embedding: this.table.embedding, // Select the embedding column
        })
        .from(this.table)
        .where(
          or(
            ilike(this.table.text, `%${query}%`),
            ilike(this.table.key, `%${query}%`)
          )
        )
        .limit(topK);

      // Get semantic search results using direct Drizzle query with pgvector operator
      const semanticMatchesData = await this.db
        .select({
          key: this.table.key,
          text: this.table.text,
          metadata: this.table.metadata,
          // pgvector's <#> operator gives negative inner product.
          // For NOMALIZED vectors, inner product IS cosine similarity.
          // So, -(negative inner product) = cosine similarity.
          negative_inner_product: sql<number>`${
            this.table.embedding
          } <#> ${JSON.stringify(queryEmbedding)}`,
        })
        .from(this.table)
        // Order by negative inner product (ascending, so most similar/least negative come first)
        .orderBy(
          sql`${this.table.embedding} <#> ${JSON.stringify(queryEmbedding)}`
        )
        .limit(topK);

      const semanticResults = semanticMatchesData.map((match) => ({
        key: match.key,
        text: match.text,
        metadata: match.metadata,
        // Convert negative inner product to cosine similarity
        similarity: -match.negative_inner_product,
      }));

      // Combine results:
      // 1. First add exact matches with calculated similarity
      const exactMatchKeys = new Set<string>();
      const exactMatchesWithSimilarity = exactMatchesData.map((match) => {
        exactMatchKeys.add(match.key);
        // Calculate similarity using embeddings; default to -1 if not possible
        const similarity =
          match.embedding && queryEmbedding
            ? this.cosineSimilarity(match.embedding, queryEmbedding)
            : -1;
        return {
          key: match.key,
          text: match.text,
          metadata: match.metadata,
          similarity: similarity,
        };
      });
      results.push(...exactMatchesWithSimilarity);

      // 2. Add semantic results that aren't exact matches
      results.push(
        ...semanticResults.filter((result) => !exactMatchKeys.has(result.key))
      );

      // 3. Sort by similarity and take top K
      results.sort((a, b) => b.similarity - a.similarity);
      results = results.slice(0, topK);

      // Cache results if enabled
      if (options?.enableCache !== false && this.cacheTable) {
        await this.cacheResults(query, results, topK, options);
      }

      return results;
    } catch (error) {
      console.error(`Error searching in ${this.tableName}:`, error);
      throw error;
    }
  }

  /**
   * Multi-query search for multiple distinct items simultaneously
   */
  async multiQuerySearch(
    queries: string[],
    topK: number = 5
  ): Promise<{ [query: string]: EmbeddingResult[] }> {
    try {
      if (queries.length === 0) {
        return {};
      }

      // Execute all searches in parallel for better performance
      const searchPromises = queries.map(async (query) => {
        const results = await this.search(query, topK);
        return { query, matches: results };
      });

      // Wait for all searches to complete
      const searchResults = await Promise.all(searchPromises);

      // Organize results by query
      const results: { [query: string]: EmbeddingResult[] } = {};
      searchResults.forEach(({ query, matches }) => {
        results[query] = matches;
      });

      return results;
    } catch (error) {
      console.error(
        `Error in multi-query search for ${this.tableName}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get existing document IDs
   */
  public async getExistingDocIds(): Promise<Set<string>> {
    try {
      const results = await this.db
        .select({
          key: this.table.key,
        })
        .from(this.table);

      const existingKeys = new Set<string>();
      if (results.length > 0) {
        results.forEach((row) => {
          if (row.key) {
            // Ensure key is not null or undefined
            existingKeys.add(row.key);
          }
        });
      }
      return existingKeys;
    } catch (error) {
      console.error(
        "Error fetching existing document IDs from iconEmbeddings table:",
        error
      );
      throw error;
    }
  }
}
