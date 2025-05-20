import { z } from "zod";
import { tool, Tool } from "@langchain/core/tools";
import type { GraphState } from "@shared/state/graph";
import { type FileMap, type FileData, fileSchema } from "@models/file";
import { type ProjectData } from "@models/project";
import { Project } from "@langgraph/models/project";

const FileSearchInputSchema = z.object({
    searchPattern: z.string().min(1, "Search pattern cannot be empty."),
    isRegex: z.boolean().optional().default(true).describe("Treat the searchPattern as a regular expression? Defaults to true."),
    matchCase: z.boolean().optional().default(false).describe("Perform a case-sensitive search? Defaults to false."),
    searchInPath: z.boolean().optional().default(true).describe("Search within the file path as well as content? Defaults to true."),
    searchInContent: z.boolean().optional().default(true).describe("Search within the file content? Defaults to true."),
    maxResults: z.number().int().positive().optional().describe("Maximum number of file paths to return.")
  });
  
// Infer the input type from the schema
type FileSearchInput = z.infer<typeof FileSearchInputSchema>;

const FileSearchOutputSchema = z.object({
   files: z.array(fileSchema),
   error: z.string().optional(),
});
type FileSearchOutput = z.infer<typeof FileSearchOutputSchema>;

export async function initializeTools(state: GraphState): Promise<{ searchFiles: Tool }> {
    const project = Project.create(state.app?.project ?? {} as ProjectData)
    const files = await project.getEditableFiles();

    async function searchFiles(args: FileSearchInput): Promise<FileSearchOutput> {
        const {
            searchPattern,
            isRegex = true,
            matchCase = false,
            searchInPath = true,
            searchInContent = true,
            maxResults
        } = args;

        const matchingFilePaths: string[] = [];

        if (!searchInPath && !searchInContent) {
            console.warn("InMemoryFileSearchTool: Both searchInPath and searchInContent are false. No search will be performed.");
            return { files: [], error: "InMemoryFileSearchTool: Both searchInPath and searchInContent are false. No search will be performed." };
        }

        let regex: RegExp;
        try {
            const flags = matchCase ? '' : 'i';
            const pattern = isRegex ? searchPattern : searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(pattern, flags);
        } catch (error: any) {
            console.error(`InMemoryFileSearchTool: Invalid regex pattern "${searchPattern}". Error: ${error.message}`);
            return { files: [], error: `Error: Invalid regex pattern "${searchPattern}"` };
        }

        // Access the 'allFilesData' fetched earlier via closure
        for (const file of Object.values(files)) {
            let foundMatch = false;

            if (searchInPath && regex.test(file.path)) {
                foundMatch = true;
            }
            if (!foundMatch && searchInContent && regex.test(file.content)) {
                foundMatch = true;
            }

            if (foundMatch) {
                matchingFilePaths.push(file.path);
                if (maxResults && matchingFilePaths.length >= maxResults) {
                    break;
                }
            }
        }
        const outputFiles = matchingFilePaths.reduce((acc, filePath) => {
            acc.push(files[filePath as keyof typeof files] as FileData);
            return acc;
        }, [] as FileData[]);
        return { files: outputFiles };
    }

    const searchFilesTool = tool(searchFiles, {
        name: "searchFiles",
        description: "Searches pre-loaded in-memory project files (paths and/or content) for a text/regex pattern. Returns a list of objects, each containing the 'filePath' and the full 'content' of the matching file.",
        schema: FileSearchInputSchema,
    });

    return {
        searchFiles: searchFilesTool
    };
}