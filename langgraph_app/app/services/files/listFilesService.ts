import { z } from "zod";
import { codeFiles as codeFilesTable, db, and, eq } from "@db";

// Input schema for the service
export const listFilesInputSchema = z.object({
    websiteId: z.number().describe("The ID of the website to list files for"),
    path: z.string().optional().describe("Optional path prefix to filter files (e.g., 'src/', 'components/')"),
    extensions: z.array(z.string()).optional().describe("Optional file extensions to filter (e.g., ['js', 'tsx'])"),
    limit: z.number().optional().describe("Maximum number of files to return"),
});

export type ListFilesInput = z.infer<typeof listFilesInputSchema>;

type CodeFileRow = typeof codeFilesTable.$inferSelect;
type CodeFile = Required<CodeFileRow>;

// Output type
export interface ListFilesOutput {
    files: Array<CodeFile>;
    totalCount: number;
    websiteId: number;
}

/**
 * Service to list files for a website
 * Provides filtering by path, extensions, and source (template vs user-modified)
 */
export class ListFilesService {
    async execute(input: ListFilesInput): Promise<ListFilesOutput> {
        const validatedInput = listFilesInputSchema.parse(input);
        let { websiteId, path, extensions, limit } = validatedInput;

        if (!limit) {
            limit = 25;
        }

        // Build query conditions
        const predicates = [
            eq(codeFilesTable.websiteId, websiteId),

            path ? eq(codeFilesTable.path, path) : undefined,
        ].filter((p) => p); // Remove undefined

        // Get files based on conditions
        let files = await db.select()
            .from(codeFilesTable)
            .where(and(...predicates))

        // Apply path filter if provided
        if (path) {
            files = files.filter(file => file.path && file.path.startsWith(path));
        }

        // Apply extension filter if provided
        if (extensions && extensions.length > 0) {
            files = files.filter(file => {
                const fileExt = file.path?.split('.').pop()?.toLowerCase();
                return fileExt && extensions.includes(fileExt);
            });
        }

        // Apply limit
        const totalCount = files.length;
        files = files.slice(0, limit);

        // Map to output format
        const formattedFiles = files.map(file => ({
            path: file.path!,
            source: file.sourceType,
            fileType: this.getFileType(file.path!),
            language: this.getLanguage(file.path!),
            shasum: file.shasum,
            createdAt: file.createdAt,
            updatedAt: file.updatedAt,
        }));

        return {
            files: formattedFiles as unknown as CodeFile[],
            totalCount,
            websiteId,
        };
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
        return match && match[1] ? match[1].toLowerCase() : '';
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