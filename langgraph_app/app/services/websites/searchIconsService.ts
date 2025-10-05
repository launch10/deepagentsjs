import { icons } from 'lucide-react';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { openai } from '@ai-sdk/openai';
import { PostgresEmbeddingsService, type Embedding, type PgCacheTable } from '@services';
import { db } from 'app/db';
import { getLlm, LLMSkill } from '@core';
import { PromptTemplate } from '@langchain/core/prompts';
import { iconEmbeddings, iconQueryCaches } from 'app/db';
export interface IconMetadata {
  tags: string[];
  categories: string[];
}
export interface IconResult {
  name: string;
  similarity: number;
  metadata: IconMetadata;
  icon: any;
}

export interface IconSearchResults {
  [query: string]: IconResult[];
}
export interface IconToolResult {
  [query: string]: string[]; // List of icon names
}

/**
 * Icon-specific implementation using the generic embeddings service
 */
export class SearchIconsService {
  private embeddingsService: PostgresEmbeddingsService;
  
  constructor() {
    // Create an instance of the generic embeddings service for icons
    this.embeddingsService = new PostgresEmbeddingsService({
      db,
      table: iconEmbeddings,
      cacheTable: iconQueryCaches,
      dimensions: 1536,
      embeddingModel: openai.embedding('text-embedding-3-small')
    });
  }
  
  /**
   * Load icon metadata from Lucide icons
   */
  async loadIconMetadata(): Promise<{ [name: string]: IconMetadata }> {
    try {
      // Get list of icon names from lucide
      const iconNames = Object.keys(icons).map((icon) => {
        return [icon,
          icon
          // Add dashes before uppercase letters
          .replace(/([A-Z])/g, '-$1')
          // Add dashes between letter-number boundaries
          .replace(/([a-zA-Z])(\d)/g, '$1-$2')
          // Convert to lowercase
          .toLowerCase()
          // Remove any leading dash
          .replace(/^-/, '')
        ]
      });
      
      // Use Promise.all to load all metadata files in parallel
      const entries = await Promise.all(
        iconNames.map(async ([name, filename]) => {
          try {
            // Use dynamic import with the correct path
            const metadata = await fs.promises.readFile(path.resolve("./.data/lucide/icons", `${filename}.json`), 'utf-8');
            const json = JSON.parse(metadata);
            
            return [name, json];
          } catch (error) {
            console.warn(`Failed to import metadata for ${name}:`, error);
            return null; // Return null for failed imports
          }
        })
      );
      
      // Filter out null entries and convert to object
      const result = Object.fromEntries(
        entries.filter(entry => entry !== null) as [string, IconMetadata][]
      );
      
      // Check if we loaded any metadata
      if (Object.keys(result).length === 0) {
        throw new Error('No metadata files were loaded successfully');
      }
      
      return result;
    } catch (error) {
      console.error('Error loading icon metadata:', error);
      throw error;
    }
  }
  
  /**
   * Normalize an icon name to make it more searchable
   */
  private normalizeIconName(name: string): string {
    return name
      // Add spaces before uppercase letters
      .replace(/([A-Z])/g, ' $1')
      // Add spaces between letter-number boundaries
      .replace(/([a-zA-Z])(\d)/g, '$1 $2')
      // Convert to lowercase
      .toLowerCase()
      // Remove any leading space
      .replace(/^\s+/, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ');
  }

  /**
   * Update and store embeddings for all icons
   */
  async generateEmbeddings(): Promise<any> {
    try {
      const iconMetadata = await this.loadIconMetadata();
      const allIconEntries = Object.entries(iconMetadata);

      // Fetch existing icon keys from the database
      const existingKeys = await this.embeddingsService.getExistingDocIds(); 
      console.log(`Found ${existingKeys.size} existing icons in the database.`);

      // Filter out icons that already have embeddings BEFORE batching
      const newIconsToProcess = allIconEntries.filter(([name, _metadata]) => !existingKeys.has(name));

      if (newIconsToProcess.length === 0) {
        console.log('All icons are already processed. No new embeddings to generate.');
        return;
      }

      console.log(`Found ${newIconsToProcess.length} new icons to process out of ${allIconEntries.length} total icons.`);

      const batchSize = 5;
      let newIconsProcessedCount = 0;

      for (let i = 0; i < newIconsToProcess.length; i += batchSize) {
        const batch = newIconsToProcess.slice(i, i + batchSize);
        
        console.log(`Processing batch from index ${i}: ${batch.length} new icons.`);

        const batchItems = await Promise.all(batch.map(async ([name, metadata]) => {
          const normalizedName = this.normalizeIconName(name);
          const llm = getLlm(LLMSkill.Writing);
          const prompt = PromptTemplate.fromTemplate(`
            Purpose: Take a lucide-icon name and generate a detailed description for it, which will support semantic querying of the icon.
            Try to imagine words that _could_ be used to describe the icon and words that could be used to query for the icon.

            Icon Name: {iconName}
            Icon Tags: {iconTags}
          `);
          const promptString = await prompt.format({iconName: name, iconTags: metadata.tags.join(' ')});
          const schema = z.object({
            description: z.string(),
          })
          const normalizer = llm.withStructuredOutput(schema);
          const response = await normalizer.invoke(promptString);
          return {
            key: name, // Use the original icon name as the key for consistency
            text: `${normalizedName} ${metadata.tags.join(' ')} ${response.description}`,
            metadata
          };
        }));
        
        if (batchItems.length > 0) {
          await this.embeddingsService.storeEmbeddings(batchItems);
          newIconsProcessedCount += batchItems.length;
          console.log(`Stored embeddings for ${batchItems.length} new icons from batch starting at index ${i}.`);
        }
      }
      console.log(`Finished generating embeddings. Total new icons processed: ${newIconsProcessedCount}`);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    }
  }
  
  async toolCall(queries: string[], topK = 5): Promise<IconToolResult> {
    try {
      const results = await this.searchIcons(queries, topK);
      return Object.entries(results).reduce((acc, [query, matches]) => {
        acc[query] = matches.map((match) => match.name);
        return acc;
      }, {} as IconToolResult);
    } catch (error) {
      console.error('Error searching icons:', error);
      throw error;
    }
  }
  /**
   * Search for icons by text query
   */
  async searchIcons(queries: string[], topK = 5): Promise<IconSearchResults> {
    try {
      // Normalize queries for better matching
      const normalizedQueries = queries.map(query => this.normalizeIconName(query));
      const originalQueryMap = new Map<string, string>();
      queries.forEach((query, index) => {
        originalQueryMap.set(normalizedQueries[index], query);
      });
      // For multi-query search, we need to handle caching individually
      const results: { [query: string]: any[] } = {};
      
      await Promise.all(normalizedQueries.map(async (query) => {
        const searchResults = await this.embeddingsService.search(query, topK, { 
          enableCache: true,
          ttlSeconds: 86400, // 24 hours
          minSimilarity: 0.25  // Cache reasonably good results
        });
        results[query] = searchResults;
      }));
      
      // Enhance results with icon data
      const enhancedResults: IconSearchResults = {};
      for (const [query, matches] of Object.entries(results)) {
        const originalQuery = originalQueryMap.get(query);
        if (!originalQuery) {
          throw new Error(`Original query not found for normalized query: ${query}`);
        }
        enhancedResults[originalQuery] = matches
          .map(match => ({
            name: match.key,
            similarity: match.similarity,
            metadata: {
              tags: match.metadata.tags,
              categories: match.metadata.categories,
            },
            icon: icons[match.key]
          }))
          .sort((a, b) => b.similarity - a.similarity); // Sort by highest similarity first
      }
      
      return enhancedResults;
    } catch (error) {
      console.error('Error searching icons:', error);
      throw error;
    }
  }

  /**
   * Get icon suggestions when no good match is found
   * @param query - The original query
   * @param threshold - Minimum similarity score to consider
   * @param topK - Maximum number of suggestions
   */
  async suggestAlternatives(query: string, threshold = 0.5, topK = 5): Promise<IconResult[]> {
    try {
      // Use the search method and filter by threshold
      const results = await this.embeddingsService.search(query, topK * 2);
      
      // Filter by threshold and limit to topK
      const matches = results
        .filter(match => match.similarity >= threshold)
        .slice(0, topK);
      
      // Enhance results with icon data
      return matches.map(match => ({
        name: match.key,
        similarity: match.similarity,
        metadata: match.metadata as IconMetadata,
        icon: icons[match.key]
      }));
    } catch (error) {
      console.error('Error suggesting alternatives:', error);
      throw error;
    }
  }
}