import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generate as generateRandomWords } from 'random-words';
import { minimatch } from 'minimatch';
import { execa } from 'execa';
import { type FileData, type FileMap } from '@models/file';

// Get the directory name in an ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the base directory for projects relative to the server location
const PROJECTS_BASE_DIR = path.resolve(__dirname, '../../../../.projects'); // Adjust path as needed
const BACKUPS_BASE_DIR = path.resolve(__dirname, '../../../../.backups'); // New backup base

/**
 * Manages the file system operations for a generated project.
 */
export class CodeManager {
    private projectRoot: string;
    private projectName: string;

    /**
     * Initializes the CodeManager for a specific project.
     * @param projectName The unique name of the project.
     */
    constructor(projectName: string) {
        if (!projectName) {
            throw new Error("Project name cannot be empty.");
        }
        // Sanitize project name to prevent path traversal issues (basic example)
        const safeProjectName = path.normalize(projectName).replace(/^\.\.[\/\\]/, ''); // Fixed regex
        if (safeProjectName.includes('..') || safeProjectName.includes('/') || safeProjectName.includes('\\')) {
             throw new Error(`Invalid project name: ${projectName}`);
        }

        this.projectName = safeProjectName;
        this.projectRoot = path.join(PROJECTS_BASE_DIR, safeProjectName);
    }

    /**
     * Public getter for the project root path.
     */
    public get rootPath(): string {
        return this.projectRoot;
    }

    async getUniqueProjectName(): Promise<string> {
        if (await this.checkProjectExists()) {
            const randomWords = generateRandomWords(3) as string[];
            return `${this.projectName}-${randomWords.join('-')}`;
        }
        return this.projectName;
    }

    /**
     * Checks if project name already exists
     * @returns {Promise<boolean>} True if project exists, false otherwise
     */
    async checkProjectExists(): Promise<boolean> {
        try {
            await fs.access(this.projectRoot);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Writes multiple files to the project directory.
     * Creates necessary subdirectories.
     * @param files A record where keys are relative file paths and values are objects with content.
     */
    async writeFiles(files: FileMap): Promise<void> {
        try {
            await fs.mkdir(this.projectRoot, { recursive: true });
        } catch (error: any) {
            console.error(`Error creating base project directory ${this.projectRoot}:`, error);
            throw new Error(`Failed to create project directory: ${error.message}`);
        }

        for (const relativePath in files) {
            const content = files[relativePath].content;
            const absolutePath = path.join(this.projectRoot, relativePath);
            const dir = path.dirname(absolutePath);

            try {
                // Ensure the file's directory exists
                await fs.mkdir(dir, { recursive: true });
                // Write the file
                await fs.writeFile(absolutePath, content, 'utf-8');
            } catch (error: any) {
                console.error(`Error writing file ${absolutePath}:`, error);
                // Decide if one error should stop the whole process or just be logged
                throw new Error(`Failed to write file ${relativePath}: ${error.message}`);
            }
        }
    }

    async installDependencies(dependencies: string[]): Promise<void> {
        await execa('npm', ['install', ...dependencies], { cwd: this.projectRoot });
    }

    /**
     * Ensures a backup of the project exists at '.backups'.
     * If a backup already exists, it returns the path. Otherwise, it creates one.
     * @returns The absolute path to the backup directory.
     * @throws If the source project directory does not exist or if copying fails.
     */
    async backupProject(): Promise<string> {
        // Backup path is now in the separate .backups directory
        const backupDirPath = path.join(BACKUPS_BASE_DIR, this.projectName);

        try {
            // 1. Check if backup directory already exists
            await fs.access(backupDirPath);
            return backupDirPath; // Return existing path
        } catch (error: any) {
            // ENOENT means the directory doesn't exist, which is expected if no backup exists yet.
            if (error.code !== 'ENOENT') {
                console.error(`Error checking backup directory ${backupDirPath}:`, error);
                throw new Error(`Failed to check backup directory: ${error.message}`);
            }
            // Backup does not exist, proceed to create it
        }

        // 2. Check if the source project directory exists before attempting to copy
        try {
            await fs.access(this.projectRoot);
        } catch (error: any) {
            console.error(`Source project directory ${this.projectRoot} does not exist.`);
            throw new Error(`Source project directory not found: ${this.projectRoot}`);
        }

        // 3. Create the backup
        try {
            // Ensure the backup base directory exists
            await fs.mkdir(BACKUPS_BASE_DIR, { recursive: true });
            // Ensure the specific backup directory exists before copying
            await fs.mkdir(backupDirPath, { recursive: true });
            // Copy the entire project directory
            await fs.cp(this.projectRoot, backupDirPath, { recursive: true });
            return backupDirPath;
        } catch (error: any) {
            console.error(`Failed to copy project directory during backup:`, error);
            throw new Error(`Backup failed for project ${this.projectName}: ${error.message}`);
        }
    }

    /**
     * Reads the content of a single file within the project.
     * @param relativePath The path relative to the project root.
     * @returns The content of the file as a string.
     * @throws If the file cannot be read (e.g., does not exist, permissions).
     */
    async readFile(relativePath: string): Promise<FileData> {
        const absolutePath = path.join(this.projectRoot, relativePath);
        try {
            const content = await fs.readFile(absolutePath, 'utf-8');
            return { path: relativePath, content };
        } catch (error: any) {
            console.error(`Error reading file ${absolutePath}:`, error);
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${relativePath}`);
            }
            throw new Error(`Failed to read file ${relativePath}: ${error.message}`);
        }
    }

    async ls(path: string): Promise<string[]> {
        return Object.keys(await this.readDirectory(path, ["node_modules"]));
    }

    getPath(inputPath: string): string {
        if (inputPath.startsWith('/')) {
            return inputPath;
        }
        return path.join(this.projectRoot, inputPath);
    }

    /**
     * Reads all files within a specified directory recursively.
     * @param relativeDirPath The path relative to the project root.
     * @param excludePatterns Optional glob patterns to exclude files/directories.
     * @returns A record where keys are relative paths (from the project root) and values are file contents.
     * @throws If the directory cannot be read.
     */
    async readDirectory(relativeDirPath: string, excludePatterns: string[] = []): Promise<FileMap> {
        const absoluteDirPath = this.getPath(relativeDirPath);
        const filesContent: FileMap = {};

        try {
            const entries = await fs.readdir(absoluteDirPath, { withFileTypes: true });

            for (const entry of entries) {
                const entryAbsolutePath = path.join(absoluteDirPath, entry.name);
                // Calculate relative path from the *project root* for matching
                const entryRelativePath = path.relative(this.projectRoot, entryAbsolutePath);

                // Check if the entry matches any exclude pattern
                const isExcluded = excludePatterns.some(pattern => minimatch(entryRelativePath, pattern, { dot: true }));

                if (isExcluded) {
                    continue; // Skip this entry
                }

                if (entry.isDirectory()) {
                    // Recursively read subdirectory, passing exclude patterns
                    const subDirFiles = await this.readDirectory(entryRelativePath, excludePatterns);
                    Object.assign(filesContent, subDirFiles); // Merge results
                } else if (entry.isFile()) {
                    try {
                        const content = await fs.readFile(entryAbsolutePath, 'utf-8');
                        // Use relative path from project root as the key
                        filesContent[entryRelativePath] = { path: entryRelativePath, content };
                    } catch (readError: any) {
                        console.error(`Error reading file ${entryAbsolutePath}:`, readError);
                        // Decide if you want to throw, skip, or log the error
                        // For now, let's just log and continue
                    }
                }
            }
        } catch (error: any) {
            console.error(`Error reading directory ${absoluteDirPath}:`, error);
            if (error.code !== 'ENOENT') { // Don't throw if the start directory doesn't exist
                throw new Error(`Failed to read directory ${relativeDirPath}: ${error.message}`);
            }
        }
        return filesContent;
    }

    // Add methods for querying files, installing dependencies etc. later if needed
    // async installDependencies(): Promise<void> { ... }
    // async getFileTree(): Promise<string[]> { ... }
}
