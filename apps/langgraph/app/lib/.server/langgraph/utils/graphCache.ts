import * as fs from 'node:fs';
import * as path from 'node:path';
import { cwd } from 'node:process';
import { createHash as nodeCreateHash } from 'node:crypto';
import stringify from "fast-json-stable-stringify";

const BASE_CACHE_DIR = path.join(cwd(), '.cache/graphs');

/**
 * Creates a SHA-256 hash of the input string.
 * @param input The string to hash.
 * @returns The hex representation of the hash.
 */
function createHash(input: string): string {
    return nodeCreateHash('sha256').update(input).digest('hex');
}

/**
 * Constructs the full path for a cache file.
 * @param queryHash Hash of the initial user query.
 * @param nodeName Name of the LangGraph node.
 * @param promptHash Hash of the specific prompt content used by the node.
 * @returns The absolute path to the cache file.
 */
function getCacheFilePath(queryHash: string, nodeName: string, promptHash: string): string {
    const queryDir = path.join(BASE_CACHE_DIR, queryHash);
    const fileName = `${nodeName}_${promptHash}.json`;
    return path.join(queryDir, fileName);
}

/**
 * Saves data to the cache.
 * @param data The data to cache (must be JSON-serializable).
 * @param initialQuery The initial user query string.
 * @param nodeName Name of the LangGraph node.
 * @param promptContent The specific prompt content used by the node.
 */
export function saveCache(data: any, initialQuery: string, nodeName: string, promptContent: string): void {
    const queryHash = createHash(initialQuery);
    const promptHash = createHash(promptContent);
    const filePath = getCacheFilePath(queryHash, nodeName, promptHash);
    const dirPath = path.dirname(filePath);

    try {
        fs.mkdirSync(dirPath, { recursive: true }); // Ensure directory exists
        const jsonString = stringify(data, null, 2);
        fs.writeFileSync(filePath, jsonString, 'utf-8');
        console.log(`[Cache] Saved cache for node "${nodeName}" to ${filePath}`);
    } catch (error) {
        console.error(`[Cache] Failed to save cache for node "${nodeName}" to ${filePath}:`, error);
    }
}

/**
 * Loads data from the cache.
 * @param initialQuery The initial user query string.
 * @param nodeName Name of the LangGraph node.
 * @param promptContent The specific prompt content used by the node.
 * @returns The cached data, or null if not found or an error occurs.
 */
export function loadCache<T>(initialQuery: string, nodeName: string, promptContent: string): T | null {
    const queryHash = createHash(initialQuery);
    const promptHash = createHash(promptContent);
    const filePath = getCacheFilePath(queryHash, nodeName, promptHash);

    try {
        if (fs.existsSync(filePath)) {
            const jsonString = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(jsonString) as T;
            console.log(`[Cache] Loaded cache for node "${nodeName}" from ${filePath}`);
            return data;
        } else {
            console.log(`[Cache] No cache found for node "${nodeName}" at ${filePath}`);
            return null;
        }
    } catch (error) {
        console.error(`[Cache] Failed to load cache for node "${nodeName}" from ${filePath}:`, error);
        return null;
    }
}
