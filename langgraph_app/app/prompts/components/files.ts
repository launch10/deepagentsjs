import { type FileMap, type FileType } from "@types";
interface FilesProps {
  files: FileMap;
  fullContentPaths?: string[];
  includeEmptyFiles?: boolean;
  tag?: string; // Optional wrapper tag name
}

/**
 * Renders a collection of files as XML elements with path attributes.
 *
 * @param files - Object mapping file paths to file content objects
 * @param fullContentPaths - Array of paths that should include full content (optional)
 * @param includeEmptyFiles - Whether to include files not in fullContentPaths as empty elements (default: true if fullContentPaths is empty)
 * @param tag - Optional wrapper tag name (default: 'files')
 *
 * @example
 * const filesMap = {
 *   'src/App.tsx': { content: 'const App = () => ...' },
 *   'src/index.tsx': { content: 'import React from ...' }
 * };
 *
 * files({ files: filesMap, fullContentPaths: ['src/App.tsx'] })
 *
 * Renders:
 * <files>
 *   <file path="src/App.tsx">
 *     const App = () => ...
 *   </file>
 *   <file path="src/index.tsx">
 *   </file>
 * </files>
 */
import { renderPrompt } from "@prompts";

export const filesPrompt = async ({
  files,
  fullContentPaths = [],
  includeEmptyFiles,
  tag = "files",
}: FilesProps): Promise<string> => {
  if (!files || Object.keys(files).length === 0) {
    return renderPrompt(`<${tag}>No existing files provided.</${tag}>`);
  }

  // Default behavior: include all files with empty content when fullContentPaths is specified
  // Only exclude empty files if explicitly set to false
  const shouldIncludeEmpty = includeEmptyFiles ?? true;

  // Sort files by path for consistent output
  const sortedFiles = Object.entries(files).sort((a, b) => a[0].localeCompare(b[0]));

  // Filter files if not including empty ones
  const filesToRender = shouldIncludeEmpty
    ? sortedFiles
    : sortedFiles.filter(([path]) => fullContentPaths.includes(path));

  const fileElements = filesToRender
    .map(([path, file]: [string, FileType]) => {
      const shouldShowContent = fullContentPaths.length === 0 || fullContentPaths.includes(path);
      // Wrap code content in CDATA to preserve it during XML parsing
      const content = shouldShowContent && file.content ? `<![CDATA[${file.content}]]>` : "";
      return `<file path="${path}">${content}</file>`;
    })
    .join("\n");

  return renderPrompt(`<${tag}>${fileElements}</${tag}>`);
};
