import type { FileMap } from "@models/file";

export const formatFiles = (fileMap: FileMap, fullContentFiles: string[] = [], includeNonFullContentFiles: boolean = false) => {
  if (!fileMap || Object.keys(fileMap).length === 0) return "No existing files provided.";
  includeNonFullContentFiles = (includeNonFullContentFiles || fullContentFiles.length === 0);  // If no full content files are provided, include all files no matter what

  const sortedFiles = Object.entries(fileMap).sort((a, b) => a[0].localeCompare(b[0]));
  if (!includeNonFullContentFiles) {
    return sortedFiles
      .filter(([path]) => fullContentFiles.includes(path))
      .map(([path, file]) => `<file path="${path}">${file.content}</file>`)
      .join("\n");
  }
  return sortedFiles
    .map(([path, file]) => `<file path="${path}">${fullContentFiles.includes(path) ? file.content : ""}</file>`)
    .join("\n");
};