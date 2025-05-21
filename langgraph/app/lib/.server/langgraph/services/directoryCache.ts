import * as fs from 'fs';
import * as crypto from 'crypto';
import * as path from 'path';
import { type FileMap } from '@models/file';
import stringify from "fast-json-stable-stringify";

// Define options for retrieving contents
export interface GetContentsOptions {
    /**
     * If provided, only include files matching these relative paths within the source directory.
     * If omitted or empty, include all readable text files.
     */
    filterFiles?: string[];
}

export class DirectoryCache {
    private readonly dirBasePath: string;
    private readonly cacheBasePath: string;

    /**
     * Creates an instance of DirectoryCache.
     * @param dirBasePath The base directory where cache files will be stored.
     */
    constructor(dirBasePath: string, cacheBasePath: string) {
        this.dirBasePath = path.resolve(dirBasePath);
        this.cacheBasePath = path.resolve(cacheBasePath);
    }

    /**
     * Retrieves the contents of a directory, using a cache if available and valid.
     * @param identifier A unique identifier for this specific directory/filter combination (used for cache naming).
     * @param sourcePath The absolute path to the source directory to read.
     * @param options Options, including optional file filtering.
     * @returns A promise resolving to the directory contents (relative path -> content mapping).
     * @throws If the source directory doesn't exist or reading fails.
     */
    async getContents(
        identifier: string,
        options?: GetContentsOptions
    ): Promise<FileMap> {

        const filterFiles = options?.filterFiles;
        const sourcePath = path.resolve(this.dirBasePath); // Ensure absolute path

        try {
            await fs.promises.access(sourcePath);
        } catch (error) {
            throw new Error(`Source directory "${sourcePath}" not found or inaccessible.`);
        }

        const hash = await this.hashDirectory(sourcePath, filterFiles);
        const cachedContents = await this.loadFromCache(identifier, hash);

        if (cachedContents) {
            console.log(`[DirectoryCache] Cache hit for identifier "${identifier}" (hash: ${hash.substring(0, 8)})`);
            return cachedContents;
        }

        console.log(`[DirectoryCache] Cache miss for identifier "${identifier}" (hash: ${hash.substring(0, 8)}). Reading from disk: ${sourcePath}`);
        const files = await this.readDirectoryRecursive(sourcePath, sourcePath, filterFiles);

        await this.saveToCache(identifier, hash, files);
        return files;
    }

    /**
     * Ensures the base cache directory exists.
     */
    private async ensureCacheDirectory(): Promise<void> {
        try {
            await fs.promises.access(this.cacheBasePath);
        } catch {
            try {
                await fs.promises.mkdir(this.cacheBasePath, { recursive: true });
            } catch (mkdirError: any) {
                // Handle potential race conditions if multiple processes create the dir
                if (mkdirError.code !== 'EEXIST') {
                    throw mkdirError;
                }
            }
        }
    }

    /**
     * Calculates a SHA256 hash based on the names and modification times of relevant files.
     * @param dirPath The absolute path to the directory.
     * @param filterFiles Optional list of relative paths to include in the hash calculation.
     */
    private async hashDirectory(dirPath: string, filterFiles?: string[]): Promise<string> {
        let relevantFiles: string[] = [];
        try {
            // Read all files recursively first to get relative paths
            const allFiles = await fs.promises.readdir(dirPath, { recursive: true, withFileTypes: true });
            relevantFiles = allFiles
                .filter(entry => entry.isFile()) // Only consider files
                .map(entry => path.relative(dirPath, path.join(entry.path ?? dirPath, entry.name))); // Get relative paths

            // Apply filter if provided
            if (filterFiles && filterFiles.length > 0) {
                const filterSet = new Set(filterFiles);
                relevantFiles = relevantFiles.filter(relativePath => filterSet.has(relativePath));
            }
        } catch (readdirError) {
            console.error(`[DirectoryCache] Error reading directory for hashing: ${dirPath}`, readdirError);
            // Return a constant hash or re-throw depending on desired behavior on read error
            return 'error_hashing_directory';
        }


        // Get stats only for the relevant files
        const statsPromises = relevantFiles.map(async (relativeFilePath) => {
            try {
                const fullPath = path.join(dirPath, relativeFilePath);
                const stat = await fs.promises.stat(fullPath);
                return `${relativeFilePath}:${stat.mtime.getTime()}`;
            } catch (statError) {
                console.warn(`[DirectoryCache] Could not stat file for hashing: ${relativeFilePath}`, statError);
                return `${relativeFilePath}:error`; // Include filename even if stat fails
            }
        });

        const stats = await Promise.all(statsPromises);

        return crypto
            .createHash('sha256')
            .update(stats.sort().join('|')) // Sort for consistent hash regardless of readdir order
            .digest('hex');
    }

    /**
     * Reads the content of a single file.
     */
    private async readFileContent(filePath: string): Promise<string> {
        try {
            return await fs.promises.readFile(filePath, 'utf-8');
        } catch (error) {
            console.error(`[DirectoryCache] Error reading file content: ${filePath}`, error);
            throw error; // Re-throw to signal failure
        }
    }

    /**
     * Recursively reads directory contents, applying filters and skipping non-text files.
     * @param currentDirPath The directory path currently being processed.
     * @param rootPath The original source directory path (for calculating relative paths).
     * @param filterFiles Optional list of relative file paths to include.
     */
    private async readDirectoryRecursive(
        currentDirPath: string,
        rootPath: string,
        filterFiles?: string[]
    ): Promise<FileMap> {
        const contents: FileMap = {};
        let entries: fs.Dirent[] = [];

        try {
            entries = await fs.promises.readdir(currentDirPath, { withFileTypes: true });
        } catch (readdirError) {
             console.error(`[DirectoryCache] Error reading directory contents: ${currentDirPath}`, readdirError);
             // Return empty or throw, depending on desired strictness
             return {};
        }

        const filterSet = (filterFiles && filterFiles.length > 0) ? new Set(filterFiles) : null;

        for (const entry of entries) {
            const fullPath = path.join(currentDirPath, entry.name);
            const relativePath = path.relative(rootPath, fullPath);

            if (entry.isDirectory()) {
                // Recurse into subdirectory
                const subContents = await this.readDirectoryRecursive(fullPath, rootPath, filterFiles);
                Object.assign(contents, subContents);
            } else if (entry.isFile()) {
                // --- Filtering Logic ---
                // 1. Skip if filters are active and file is not in the set
                if (filterSet && !filterSet.has(relativePath)) {
                    continue;
                }
                // 2. Skip common non-text/binary files (adjust regex as needed)
                // Basic check, might need refinement for edge cases
                if (!/\.(?:txt|json|js|jsx|ts|tsx|css|html|md|yml|yaml|xml|svg|gitignore|npmignore|eslintrc|prettierrc|env|dockerfile|dockerignore|sh|cmd|bat)$/i.test(entry.name)) {
                     console.log(`[DirectoryCache] Skipping potentially non-text file: ${relativePath}`);
                    continue;
                }

                // --- Read Content ---
                try {
                    const content = await this.readFileContent(fullPath);
                    contents[relativePath] = { path: relativePath, content, fileType: "Template" };
                 } catch (readFileError) {
                    // Log error but potentially continue processing other files
                    console.error(`[DirectoryCache] Failed to read content for ${relativePath}, skipping file.`);
                 }
            }
            // Ignore other entry types (symlinks, sockets, etc.) for simplicity
        }

        return contents;
    }

    /**
     * Constructs the full path for a cache file.
     */
    private getCachePath(identifier: string, hash: string): string {
        // Sanitize identifier slightly to avoid problematic filename characters
        const safeIdentifier = identifier.replace(/[^a-z0-9_-]/gi, '_');
        return path.join(this.cacheBasePath, `cache_${safeIdentifier}_${hash}.json`);
    }

    /**
     * Attempts to load directory contents from the cache file.
     * @returns The cached data or null if not found or invalid.
     */
    private async loadFromCache(identifier: string, hash: string): Promise<FileMap | null> {
        const cachePath = this.getCachePath(identifier, hash);
        try {
            const cacheContent = await fs.promises.readFile(cachePath, 'utf-8');
            // Basic validation: Check if it's parseable JSON
            const parsed = JSON.parse(cacheContent);
            if (typeof parsed === 'object' && parsed !== null) {
                // Could add more sophisticated validation here if needed (e.g., using Zod)
                return parsed as FileMap;
            }
            console.warn(`[DirectoryCache] Invalid JSON content in cache file: ${cachePath}`);
            return null;
        } catch (error: any) {
            // ENOENT (file not found) is expected for a cache miss
            if (error.code !== 'ENOENT') {
                console.error(`[DirectoryCache] Error loading from cache: ${cachePath}`, error);
            }
            return null;
        }
    }

    /**
     * Saves the directory contents to the cache file.
     */
    private async saveToCache(identifier: string, hash: string, contents: FileMap): Promise<void> {
        try {
            await this.ensureCacheDirectory();
            const cachePath = this.getCachePath(identifier, hash);
            await fs.promises.writeFile(cachePath, stringify(contents, null, 2)); // Pretty print JSON
            console.log(`[DirectoryCache] Saved cache for identifier "${identifier}" to ${cachePath}`);
        } catch (error) {
            console.error(`[DirectoryCache] Error saving to cache: ${identifier}`, error);
            // Optionally, re-throw or handle more gracefully
        }
    }
}