import * as path from "path";
import * as fs from "fs";

/**
 * Find the monorepo root by looking for marker files
 * Walks up the directory tree looking for .git or root package.json with workspaces
 */
function findMonorepoRoot(startDir: string = __dirname): string {
  let currentDir = startDir;

  // Walk up the directory tree
  while (currentDir !== path.dirname(currentDir)) {
    // Check for .git directory (reliable monorepo root marker)
    if (fs.existsSync(path.join(currentDir, ".git"))) {
      // Verify this is the launch10 monorepo by checking for expected subdirs
      const hasLanggraph = fs.existsSync(path.join(currentDir, "langgraph_app"));
      const hasRails = fs.existsSync(path.join(currentDir, "rails_app"));
      const hasShared = fs.existsSync(path.join(currentDir, "shared"));

      if (hasLanggraph && hasRails && hasShared) {
        return currentDir;
      }
    }

    currentDir = path.dirname(currentDir);
  }

  throw new Error(
    "Could not find monorepo root. Expected to find .git directory with langgraph_app, rails_app, and shared subdirectories."
  );
}

// Cache the root to avoid repeated filesystem walks
let _cachedRoot: string | null = null;

/**
 * Get the monorepo root directory (launch10/)
 */
export function getMonorepoRoot(): string {
  if (!_cachedRoot) {
    _cachedRoot = findMonorepoRoot();
  }
  return _cachedRoot;
}

/**
 * Get the langgraph_app directory path
 */
export function getLanggraphRoot(): string {
  return path.join(getMonorepoRoot(), "langgraph_app");
}

/**
 * Get the rails_app directory path
 */
export function getRailsRoot(): string {
  return path.join(getMonorepoRoot(), "rails_app");
}

/**
 * Get the shared directory path
 */
export function getSharedRoot(): string {
  return path.join(getMonorepoRoot(), "shared");
}

/**
 * Get the packages directory path
 */
export function getPackagesRoot(): string {
  return path.join(getMonorepoRoot(), "packages");
}

/**
 * Project paths object for convenient access
 */
export const projectPaths = {
  get root() {
    return getMonorepoRoot();
  },
  get langgraph() {
    return getLanggraphRoot();
  },
  get rails() {
    return getRailsRoot();
  },
  get shared() {
    return getSharedRoot();
  },
  get packages() {
    return getPackagesRoot();
  },
  /** Rails test fixtures directory */
  get railsFixtures() {
    return path.join(getRailsRoot(), "spec", "fixtures", "files");
  },
};
