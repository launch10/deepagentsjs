// Re-export from manager for new API
export { WebContainerManager, WORK_DIR_NAME, WORK_DIR } from "./manager";

// Legacy exports for backward compatibility
// The manager is now the source of truth for WebContainer
import { WebContainerManager } from "./manager";

/**
 * @deprecated Use WebContainerManager instead.
 * This is kept for backward compatibility during migration.
 * Returns a promise that resolves to the WebContainer instance from the manager.
 */
export const webcontainer = WebContainerManager.getInstance();

export * from "./types";
export * from "./file-utils";
