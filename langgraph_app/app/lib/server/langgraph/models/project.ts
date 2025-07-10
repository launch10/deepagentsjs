import { CodeManager } from "@services/codeManager";
import { ProjectMode, type ProjectData } from "@shared/models/project";
import { type ProjectPlan } from "@shared/models/project/projectPlan";
import { type PageData } from "@shared/models/page";
import { projectSchema } from "@shared/models/project";
import { type FileData, type FileMap } from "@shared/models/file";
import { projectsApi } from "@rails_api/index";

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
    public readonly themeId?: number;
    private projectId?: string;

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
        this.themeId = data.themeId;
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

    setProjectId(projectId: string) {
        this.projectId = projectId;
    }

    getEditableFiles(jwt: string): Promise<FileMap> {
        const { includes, excludes } = this.getEditableFilePaths();
        return this.getFiles(includes, excludes, 'main', jwt);
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
        source: 'main' | 'backup' = 'main',
        jwt?: string
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

        const results: FileMap = {};
        
        const projectExists = await this.codeManager.checkProjectExists();
        if (!projectExists) {
            // Fetch files from Rails API if project doesn't exist locally
            if (this.projectId && jwt) {
                console.log(`Project not found locally. Fetching files from Rails API for project ${this.projectId}`);
                const response = await projectsApi.getProjectFiles(this.projectId, jwt);
                
                if (response.success && response.data) {
                    // Convert array of files to FileMap format
                    const filesToWrite: FileMap = {};
                    for (const file of response.data) {
                        if (file.path && file.content) {
                            filesToWrite[file.path] = {
                                content: file.content,
                                fileSpecificationId: file.fileSpecificationId
                            };
                        }
                    }
                    // Write all files to local filesystem
                    await this.codeManager.writeFiles(filesToWrite);
                    console.log(`Successfully downloaded ${Object.keys(filesToWrite).length} files from Rails API`);
                    
                    // Now read the files from disk using the standard method
                    // This ensures we apply the filePaths and excludes filters properly
                    return this.codeManager.getFiles(targetRoot, filePaths, excludes, source);
                } else {
                    console.error('Failed to fetch files from Rails API:', response.error);
                    throw new Error(`Failed to fetch project files: ${response.error?.message || 'Unknown error'}`);
                }
            } else {
                console.warn('Cannot fetch files from Rails API: Missing projectId or JWT');
                return results;
            }
        } else {
            return this.codeManager.getFiles(targetRoot, filePaths, excludes, source);
        }
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
            pages: this.pages,
            themeId: this.themeId
        };
        return data;
    }
}