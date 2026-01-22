import type { FileSystemTree } from "@webcontainer/api";
import type { Website } from "@shared";

interface FileSystemFileEntry {
  file: {
    contents: string | Uint8Array;
  };
}

interface FileSystemDirectoryEntry {
  directory: FileSystemTree;
}

/**
 * Converts a FileMap (from langgraph state) to a WebContainer FileSystemTree.
 * FileMap format: { "/path/to/file": { content: string, created_at: string, modified_at: string } }
 * FileSystemTree format: { "path": { "to": { "file": { file: { contents: "..." } } } } }
 */
export function convertFileMapToFileSystemTree(fileMap: Website.FileMap): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const filePath in fileMap) {
    if (!Object.prototype.hasOwnProperty.call(fileMap, filePath)) {
      continue;
    }

    const fileData = fileMap[filePath];
    if (!fileData || typeof fileData.content !== "string") {
      console.warn(`Skipping file due to missing or invalid data: ${filePath}`);
      continue;
    }

    const segments = filePath.split("/").filter((segment) => segment.length > 0);
    let currentLevel = tree;

    segments.forEach((segment, index) => {
      const isLastSegment = index === segments.length - 1;

      if (isLastSegment) {
        currentLevel[segment] = {
          file: { contents: fileData.content },
        } as FileSystemFileEntry;
      } else {
        if (!currentLevel[segment]) {
          currentLevel[segment] = { directory: {} } as FileSystemDirectoryEntry;
        } else if (!(currentLevel[segment] as FileSystemDirectoryEntry).directory) {
          console.warn(
            `Conflict: Path '${filePath}' requires '${segment}' to be a directory, but it was not. Overwriting with directory.`
          );
          currentLevel[segment] = { directory: {} } as FileSystemDirectoryEntry;
        }
        currentLevel = (currentLevel[segment] as FileSystemDirectoryEntry).directory;
      }
    });
  }
  return tree;
}

/**
 * Creates a minimal package.json for running a static HTML site.
 * Only used as fallback when files don't include their own package.json.
 */
export function createStaticSitePackageJson(): FileSystemTree {
  return {
    "package.json": {
      file: {
        contents: JSON.stringify(
          {
            name: "landing-page",
            version: "1.0.0",
            scripts: {
              dev: "npx -y serve -l 3000 .",
            },
            dependencies: {},
          },
          null,
          2
        ),
      },
    },
  };
}

/**
 * Checks if a FileMap contains a package.json file.
 */
export function hasPackageJson(fileMap: Website.FileMap): boolean {
  return "/package.json" in fileMap || "package.json" in fileMap;
}

/**
 * Merges a FileSystemTree with additional files.
 */
export function mergeFileSystemTrees(...trees: FileSystemTree[]): FileSystemTree {
  const result: FileSystemTree = {};

  for (const tree of trees) {
    Object.assign(result, tree);
  }

  return result;
}
