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
 * Diffs two FileMaps, returning only files whose content changed.
 * Returns null if nothing changed (all content identical).
 * Returns the full current map when previous is null (initial mount).
 *
 * Comparison is content-only — metadata (modified_at) is ignored.
 * Deleted files are ignored because WebContainer mount() is additive.
 */
export function diffFileMap(
  previous: Website.FileMap | null,
  current: Website.FileMap
): Website.FileMap | null {
  if (!previous) return current;

  const changed: Website.FileMap = {};
  let hasChanges = false;

  for (const path in current) {
    if (!Object.prototype.hasOwnProperty.call(current, path)) continue;

    const prevFile = previous[path];
    const currFile = current[path];

    if (!prevFile || prevFile.content !== currFile.content) {
      changed[path] = currFile;
      hasChanges = true;
    }
  }

  return hasChanges ? changed : null;
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
 * Injects a small inline script into index.html that fires a postMessage
 * to the parent frame when the page content has actually rendered.
 * This lets WebsitePreview keep the loading overlay until real content is visible,
 * avoiding the blank flash while Vite compiles modules.
 */
const PREVIEW_READINESS_SCRIPT = `<script>
(function() {
  var root = document.getElementById('root');
  if (!root) {
    window.parent.postMessage({ type: 'preview-ready' }, '*');
    return;
  }
  if (root.children.length > 0) {
    window.parent.postMessage({ type: 'preview-ready' }, '*');
    return;
  }
  var observer = new MutationObserver(function() {
    if (root.children.length > 0) {
      observer.disconnect();
      window.parent.postMessage({ type: 'preview-ready' }, '*');
    }
  });
  observer.observe(root, { childList: true });
})();
</script>`;

export function injectPreviewReadinessScript(fileMap: Website.FileMap): Website.FileMap {
  const indexKey = "/index.html" in fileMap ? "/index.html" : "index.html" in fileMap ? "index.html" : null;
  if (!indexKey) return fileMap;

  const indexFile = fileMap[indexKey];
  if (!indexFile || typeof indexFile.content !== "string") return fileMap;

  const modifiedContent = indexFile.content.replace("</body>", `${PREVIEW_READINESS_SCRIPT}\n</body>`);

  return {
    ...fileMap,
    [indexKey]: {
      ...indexFile,
      content: modifiedContent,
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
