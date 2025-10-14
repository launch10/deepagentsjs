/**
 * File listing tool with support for simple lists and tree views.
 * 
 * This tool provides a lightweight way to list files matching path patterns,
 * similar to grep but focused solely on file paths. It's optimized for quickly
 * finding files when you know part of the filename or directory structure.
 * 
 * KEY FEATURES:
 * - Simple pattern matching on file paths
 * - Two display modes: list and tree view
 * - Returns structured data for easy model consumption
 * - Supports wildcards and partial matches
 * - Formatted output for better readability
 * 
 * EXAMPLES:
 * List all TypeScript files:
 *   { pattern: '.ts', view: 'list' }
 * 
 * Find components in tree view:
 *   { pattern: 'component', view: 'tree' }
 * 
 * Find files in specific directory:
 *   { pattern: 'src/components/', view: 'tree' }
 */

import { z } from "zod";
import { tool, Tool } from "@langchain/core/tools";
import type { WebsiteBuilderGraphState} from "@state";
import { CodeFileModel } from "@models";

const description = `
    File listing tool with support for simple lists and tree views.

    CAPABILITIES:
    • Fast pattern matching on file paths
    • Two display modes: 'list' (flat) and 'tree' (hierarchical)
    • Returns structured data optimized for AI model consumption
    • Supports partial matches anywhere in path
    • Formatted output with indentation for readability
    
    USE CASES:
    • Find all files of a certain type (.ts, .tsx, .css)
    • Visualize project structure with tree view
    • Locate files in specific directories
    • Quick file discovery by name pattern
    • Get file structure overview

    VIEW MODES:
    • 'list': Simple flat list of file paths
    • 'tree': Hierarchical tree structure showing directories and files

    EXAMPLES:
    • List TypeScript files: pattern='.ts', view='list'
    • Tree view of components: pattern='component', view='tree'
    • Files in directory: pattern='src/components/', view='tree'
    • All test files in tree: pattern='test', view='tree'
`

const ListFilesInputSchema = z.object({
    pattern: z.string().optional().default("*").describe(
        "Pattern to match against file paths. Searches for this pattern anywhere in the path."
    ),
    limit: z.number().int().positive().optional().default(100).describe(
        "Maximum number of files to return. Default is 100."
    ),
    view: z.enum(['list', 'tree']).optional().default('list').describe(
        "Display format: 'list' for flat list or 'tree' for hierarchical tree view. Default is 'list'."
    )
});

type ListFilesInput = z.infer<typeof ListFilesInputSchema>;

const FileListItemSchema = z.object({
    path: z.string(),
});

const TreeNodeSchema: z.ZodSchema<any> = z.lazy(() => z.object({
    name: z.string(),
    type: z.enum(['directory', 'file']),
    path: z.string(),
    children: z.array(TreeNodeSchema).optional()
}));

const ListFilesOutputSchema = z.object({
    files: z.array(FileListItemSchema).optional(),
    tree: TreeNodeSchema.optional(),
    formattedOutput: z.string(),
    totalMatches: z.number(),
    truncated: z.boolean(),
    view: z.enum(['list', 'tree'])
});

type ListFilesOutput = z.infer<typeof ListFilesOutputSchema>;
type TreeNode = {
    name: string;
    type: 'directory' | 'file';
    path: string;
    children?: TreeNode[];
};

// Helper function to build tree structure from file paths
function buildTreeFromPaths(paths: string[]): TreeNode {
    const root: TreeNode = {
        name: '.',
        type: 'directory',
        path: '.',
        children: []
    };

    // Sort paths to ensure directories come before their contents
    const sortedPaths = [...paths].sort();

    for (const path of sortedPaths) {
        const parts = path.split('/').filter(p => p);
        let currentNode = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLastPart = i === parts.length - 1;
            const currentPath = parts.slice(0, i + 1).join('/');

            // Check if this part already exists in children
            let childNode = currentNode.children?.find(child => child.name === part);

            if (!childNode) {
                childNode = {
                    name: part,
                    type: isLastPart ? 'file' : 'directory',
                    path: currentPath,
                    children: isLastPart ? undefined : []
                };
                
                if (!currentNode.children) {
                    currentNode.children = [];
                }
                currentNode.children.push(childNode);
            }

            if (!isLastPart) {
                currentNode = childNode;
            }
        }
    }

    return root;
}

// Helper function to format tree as string for display
function formatTree(node: TreeNode, prefix: string = '', isLast: boolean = true): string {
    let result = '';
    
    if (node.name !== '.') {
        const connector = isLast ? '└── ' : '├── ';
        const icon = node.type === 'directory' ? '📁 ' : '📄 ';
        result += prefix + connector + icon + node.name + '\n';
    }

    if (node.children) {
        const children = node.children.sort((a, b) => {
            // Directories first, then files
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        children.forEach((child, index) => {
            const isLastChild = index === children.length - 1;
            const extension = node.name === '.' ? '' : (isLast ? '    ' : '│   ');
            result += formatTree(child, prefix + extension, isLastChild);
        });
    }

    return result;
}

// Helper function to format list view
function formatList(files: { path: string }[]): string {
    return files.map(f => `• ${f.path}`).join('\n');
}

const outputTree = (files: { path: string }[], truncated: boolean, pattern: string, limit: number) => {
    // Build tree structure
    const paths = files.map(f => f.path);
    const tree = buildTreeFromPaths(paths);
    
    // Format tree for display
    let formattedOutput = `Found ${Math.min(files.length, limit)} file(s) matching "${pattern}":\n\n`;
    formattedOutput += formatTree(tree);
    
    if (truncated) {
        formattedOutput += `\n... and ${files.length - limit} more file(s) (truncated at limit: ${limit})`;
    }
    
    return [tree, formattedOutput];
}

const outputList = (files: { path: string }[], truncated: boolean, pattern: string, limit: number) => {
    let formattedOutput = `Found ${Math.min(files.length, limit)} file(s) matching "${pattern}":\n\n`;
    formattedOutput += formatList(files);
    
    if (truncated) {
        formattedOutput += `\n\n... and ${files.length - limit} more file(s) (truncated at limit: ${limit})`;
    }
    
    return [files, formattedOutput];
}

const outputters = {
    list: outputList,
    tree: outputTree
}

export async function initListFiles(state: GraphState): Promise<{ listFiles: Tool }> {
    const websiteId = state?.website?.id;

    async function listFiles(args?: ListFilesInput): Promise<ListFilesOutput> {
        const { limit = 100, view = 'list' } = args || {};
        const pattern = args?.pattern;

        try {
            // Use pathFuzzy for pattern matching on paths
            const results = await CodeFileModel.pathFuzzy(pattern, websiteId, limit);
            
            // Limit results
            const truncated = results.length == limit;
            
            // Transform results to simple path objects
            const files = results.map((file: any) => ({
                path: file.path
            }));

            const [output, formattedOutput] = outputters[view](files, truncated, pattern, limit);

            return {
                files: view === 'list' ? output : undefined,
                tree: view === 'tree' ? output : undefined,
                formattedOutput,
                totalMatches: Math.min(results.length, limit),
                truncated,
                view
            };
        } catch (error: any) {
            console.error(`ListFiles error: ${error.message}`);
            return {
                files: view === 'list' ? [] : undefined,
                tree: view === 'tree' ? { name: '.', type: 'directory', path: '.', children: [] } : undefined,
                formattedOutput: `Error: Failed to list files - ${error.message}`,
                totalMatches: 0,
                truncated: false,
                view
            };
        }
    }

    const listFilesTool = tool(listFiles, {
        name: "listFiles",
        description,
        schema: ListFilesInputSchema,
    });

    return {
        listFiles: listFilesTool
    };
}

export const initTools = initListFiles;