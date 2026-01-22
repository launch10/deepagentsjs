/**
 * Utility to read example website files directly from disk.
 * This replaces the generated cache files approach - single source of truth.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { Website } from "@types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXAMPLES_DIR = path.resolve(__dirname, "../../../../shared/websites/examples");

// Files/directories to skip
const SKIP_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  ".DS_Store",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
];

function shouldSkip(name: string): boolean {
  return SKIP_PATTERNS.some(
    (pattern) => name === pattern || name.includes(pattern)
  );
}

function readFilesRecursively(
  dir: string,
  baseDir: string
): Record<string, string> {
  const files: Record<string, string> = {};
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldSkip(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    const relativePath = "/" + path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      Object.assign(files, readFilesRecursively(fullPath, baseDir));
    } else {
      const content = fs.readFileSync(fullPath, "utf-8");
      files[relativePath] = content;
    }
  }

  return files;
}

/**
 * Read example files from disk and convert to Website.FileMap format.
 * Results are cached after first read.
 */
const fileCache = new Map<string, Website.FileMap>();

export function readExampleFiles(exampleName: string): Website.FileMap {
  if (fileCache.has(exampleName)) {
    return fileCache.get(exampleName)!;
  }

  const exampleDir = path.join(EXAMPLES_DIR, exampleName);

  if (!fs.existsSync(exampleDir)) {
    throw new Error(`Example directory not found: ${exampleDir}`);
  }

  const rawFiles = readFilesRecursively(exampleDir, exampleDir);
  const now = new Date().toISOString();

  const fileMap: Website.FileMap = {};
  for (const [filePath, content] of Object.entries(rawFiles)) {
    fileMap[filePath] = {
      content,
      created_at: now,
      modified_at: now,
    };
  }

  fileCache.set(exampleName, fileMap);
  return fileMap;
}

/**
 * Get scheduling tool example files.
 */
export function getSchedulingToolFiles(): Website.FileMap {
  return readExampleFiles("scheduling-tool");
}
