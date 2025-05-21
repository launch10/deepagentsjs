import { promises as fs } from "fs";
import path from 'path';
import micromatch from 'micromatch';
import { CodeManager } from "@services/codeManager";
import { ProjectMode, type ProjectData } from "@shared/models/project";
import { type ProjectPlan } from "@shared/models/project/projectPlan";
import { type PageData } from "@shared/models/page";
import { projectSchema } from "@shared/models/project";
import { type FileData, type FileMap } from "@shared/models/file";

interface EditablePaths {
    includes: string[];
    excludes: string[];
}
/**
 * Represents a project being worked on.
 * Encapsulates project details and operations like backup and file access.
 */
export class Project {
    private codeManager: CodeManager;
    public readonly projectName: string;
    public readonly tenantId: number | undefined;
    public readonly projectMode: ProjectMode;
    public readonly rootPath: string;
    public backupPath?: string;
    public readonly projectPlan: ProjectPlan;
    public readonly pages: PageData[];

    private constructor(data: ProjectData) {
        const validation = projectSchema.safeParse(data);
        // if (!validation.success) {
        //     // Handle validation errors appropriately
        //     console.error("Project data validation failed:", validation.error.errors);
        //     throw new Error(`Invalid project data: ${validation.error.message}`);
        // }
        
        this.projectName = data.projectName;
        this.codeManager = new CodeManager(this.projectName);
        this.rootPath = this.codeManager.rootPath; // Get root path from CodeManager
        this.backupPath = data.backupPath;
        this.projectPlan = data.projectPlan;
        this.pages = data.pages;
        this.tenantId = data.tenantId;
        this.projectMode = data.projectMode;
    }

    /**
     * Factory method to create a Project instance from validated data.
     * @param data Project data object.
     * @returns A new Project instance.
     */
    public static create(data: ProjectData): Project {
        // You might add more complex initialization or validation here if needed
        return new Project(data);
    }

    /**
     * Creates a backup of the project.
     * @returns The path to the created backup directory.
     * @throws If backup fails.
     */
    async backup(): Promise<string> {
        try {
            console.log(`Project class: Initiating backup for ${this.projectName}`);
            this.backupPath = await this.codeManager.backupProject();
            console.log(`Project class: Backup successful, path: ${this.backupPath}`);
            return this.backupPath;
        } catch (error) {
             console.error(`Project class: Backup failed for ${this.projectName}:`, error);
             throw error; // Re-throw the error to be handled by the caller node
        }
    }

    getEditableFiles(): Promise<FileMap> {
        const { includes, excludes } = this.getEditableFilePaths();
        return this.getFiles(includes, excludes);
    }
   
    /**
     * Defines the paths/patterns to include and exclude when getting files for updates.
     * @returns An object with 'includes' and 'excludes' arrays (glob patterns).
     */
    getEditableFilePaths(): EditablePaths {
        return {
            includes: [
                'src/pages/IndexPage.tsx',
                'src/index.css',
                'tailwind.config.ts',
                'src/components', // Include the whole directory initially
            ],
            excludes: [
                'src/components/ui/**', // Exclude everything under src/components/ui using globstar
            ]
        };
    }

    /**
     * Reads specified files or directories, optionally from a backup.
     * Can read from the main project or a backup.
     * @param filePaths Relative paths of the files/directories to read.
     * @param excludes Optional array of glob patterns to exclude.
     * @param source 'main' or 'backup' to specify where to read from.
     * @returns A promise resolving to an array of FileData objects.
     * @throws If reading fails or source is invalid.
     */
    async getFiles(
        filePaths: string[] = [], 
        excludes: string[] = [], // Added excludes parameter
        source: 'main' | 'backup' = 'main'
    ): Promise<FileMap> {
        const targetRoot = source === 'backup' ? this.backupPath : this.rootPath;

        if (filePaths.length === 0) {
            filePaths = await this.codeManager.ls(this.rootPath);
        }

        if (source === 'backup' && !targetRoot) {
            throw new Error("Cannot read from backup: Backup path is not set.");
        }
        if (!targetRoot) {
             throw new Error("Project root path is not available."); // Should not happen if constructor ran
        }

        console.log(`Project class: Reading files from ${source} source (${targetRoot})...`);
        
        const results: FileMap = {};
        
        for (const relativePath of filePaths) {
            const absolutePath = path.join(targetRoot, relativePath);
            try {
                 // Check if it's a directory path provided (like 'src/components')
                 const stats = await fs.stat(absolutePath);
                 if (stats.isDirectory()) {
                     // Pass excludes down to readDirectory
                     const dirFiles: FileMap = await this.codeManager.readDirectory(relativePath, excludes); 
                     for (const [filePath, file] of Object.entries(dirFiles)) {
                         results[filePath] = file;
                     }
                 } else {
                     // Check individual file against excludes before reading
                     if (micromatch.isMatch(relativePath, excludes)) {
                         console.log(`Project.getFiles: Excluding single file ${relativePath} due to pattern match.`);
                         continue;
                     }
                     const file: FileData = await this.codeManager.readFile(relativePath); // Use main codeManager
                     results[relativePath] = file;
                 }
            } catch (error: any) {
                 console.error(`Project class: Failed to read '${relativePath}' from ${source}:`, error);
                 // Decide how to handle partial failure: skip or throw?
                 // Let's throw for now.
                 throw new Error(`Failed to read file/directory ${relativePath} from ${source}: ${error.message}`);
            }
        }

        console.log(`Project class: Successfully read ${Object.keys(results).length} file entries.`);
        return results;
    }

    /**
     * Converts the Project instance to a plain data object suitable for state.
     * @returns ProjectData object.
     */
    toDataObject(): ProjectData {
        // Ensure only data defined in the schema is returned
        const data: ProjectData = {
            projectName: this.projectName,
            tenantId: this.tenantId,
            projectMode: this.projectMode,
            rootPath: this.rootPath,
            backupPath: this.backupPath,
            projectPlan: this.projectPlan,
            pages: this.pages
        };
        return data;
    }
}