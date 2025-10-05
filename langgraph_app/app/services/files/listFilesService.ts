import { z } from "zod";
import { CodeFileModel } from "@models";
import { CodeFileSourceEnum } from "@types";
import { withInfrastructure, defaultCachePolicy } from "@core";

// Input schema for the service
export const listFilesInputSchema = z.object({
    websiteId: z.number().describe("The ID of the website to list files for"),
    path: z.string().optional().describe("Optional path prefix to filter files (e.g., 'src/', 'components/')"),
    extensions: z.array(z.string()).optional().describe("Optional file extensions to filter (e.g., ['js', 'tsx'])"),
    source: z.nativeEnum(CodeFileSourceEnum).optional().describe("Filter by source: 'website' for user-modified, 'template' for defaults"),
    limit: z.number().optional().default(25).describe("Maximum number of files to return"),
});

export type ListFilesInput = z.infer<typeof listFilesInputSchema>;

// Output type
export interface ListFilesOutput {
    files: Array<{
        path: string;
        source: CodeFileSourceEnum;
        fileType: string;
        language: string;
        shasum: string | null;
        createdAt: Date | string;
        updatedAt: Date | string;
    }>;
    totalCount: number;
    websiteId: number;
}

/**
 * Service to list files for a website
 * Provides filtering by path, extensions, and source (template vs user-modified)
 */
export class ListFilesService {
    @withInfrastructure({
        cache: {
            prefix: "list-files",
            ...defaultCachePolicy,
            ttl: 300, // 5 minutes cache
        }
    })
    async execute(input: ListFilesInput): Promise<ListFilesOutput> {
        const validatedInput = listFilesInputSchema.parse(input);
        const { websiteId, path, extensions, source, limit } = validatedInput;

        // Build query conditions
        const conditions: any = { websiteId };
        
        if (source) {
            conditions.source = source;
        }

        // Get files based on conditions
        let files = await CodeFileModel.where(conditions);

        // Apply path filter if provided
        if (path) {
            files = files.filter(file => file.path.startsWith(path));
        }

        // Apply extension filter if provided
        if (extensions && extensions.length > 0) {
            files = files.filter(file => {
                const fileExt = file.path.split('.').pop()?.toLowerCase();
                return fileExt && extensions.includes(fileExt);
            });
        }

        // Apply limit
        const totalCount = files.length;
        files = files.slice(0, limit);

        // Map to output format
        const formattedFiles = files.map(file => ({
            path: file.path,
            source: file.source,
            fileType: this.getFileType(file.path),
            language: this.getLanguage(file.path),
            shasum: file.shasum,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
        }));

        return {
            files: formattedFiles,
            totalCount,
            websiteId,
        };
    }

    /**
     * List only user-modified files
     */
    async listWebsiteFiles(websiteId: number, limit?: number): Promise<ListFilesOutput> {
        return this.execute({
            websiteId,
            source: CodeFileSourceEnum.Website,
            limit,
        });
    }

    /**
     * List only template files
     */
    async listTemplateFiles(websiteId: number, limit?: number): Promise<ListFilesOutput> {
        return this.execute({
            websiteId,
            source: CodeFileSourceEnum.Template,
            limit,
        });
    }

    /**
     * List files by type
     */
    async listFilesByType(websiteId: number, extensions: string[], limit?: number): Promise<ListFilesOutput> {
        return this.execute({
            websiteId,
            extensions,
            limit,
        });
    }

    /**
     * Get file type from path
     */
    private getFileType(path: string): string {
        const match = path.match(/\.([^.]+)$/);
        return match ? match[1].toLowerCase() : '';
    }

    /**
     * Get language from file extension
     */
    private getLanguage(path: string): string {
        const ext = this.getFileType(path);
        const languageMap: Record<string, string> = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'rb': 'ruby',
            'py': 'python',
            'css': 'css',
            'scss': 'css',
            'sass': 'css',
            'html': 'html',
            'htm': 'html',
            'json': 'json',
            'md': 'markdown',
            'yml': 'yaml',
            'yaml': 'yaml',
        };
        return languageMap[ext] || ext;
    }
}