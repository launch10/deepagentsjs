import { useState, useEffect, useRef, useCallback } from "react";
import {
  WebContainerManager,
  convertFileMapToFileSystemTree,
  createStaticSitePackageJson,
  mergeFileSystemTrees,
  hasPackageJson,
  injectPreviewReadinessScript,
  diffFileMap,
  type WebContainerStatus,
} from "@lib/webcontainer";
import { useWebsiteChatState } from "./useWebsiteChat";
import type { Website } from "@shared";

type ConsoleError = Website.Errors.ConsoleError;

interface UseWebsitePreviewReturn {
  previewUrl: string | null;
  status: WebContainerStatus;
  error: string | null;
  /** Build + runtime errors from WebContainer, maps 1:1 to WebsiteAnnotation.consoleErrors */
  consoleErrors: ConsoleError[];
  reload: () => void;
}

/**
 * Derives the appropriate status from the manager's warmup state.
 */
function getStatusFromManagerState(): WebContainerStatus {
  const state = WebContainerManager.getState();

  if (state.viteRunning && state.previewUrl) {
    return "ready";
  }
  if (state.depsInstalled) {
    return "starting";
  }
  if (state.booted) {
    return "installing";
  }
  if (WebContainerManager.isWarmupStarted()) {
    return "booting";
  }
  return "idle";
}

/**
 * Hook that manages the WebContainer lifecycle for website preview.
 * Listens to files from langgraph state and mounts them to WebContainer.
 *
 * This hook leverages WebContainerManager for eager warmup support.
 * If warmup has already completed (started on app init), file mounting
 * will be nearly instant.
 */
export function useWebsitePreview(): UseWebsitePreviewReturn {
  const files = useWebsiteChatState("files");

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    WebContainerManager.getState().previewUrl
  );
  const [status, setStatus] = useState<WebContainerStatus>(getStatusFromManagerState);
  const [error, setError] = useState<string | null>(null);
  const [consoleErrors, setConsoleErrors] = useState<ConsoleError[]>(
    WebContainerManager.getConsoleErrors()
  );

  const mountedFilesRef = useRef<Website.FileMap | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Reload the preview iframe
  const reload = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  // Clean up project files when leaving the website page.
  // This prevents stale files from a previous website showing when
  // navigating to a different website later.
  useEffect(() => {
    return () => {
      WebContainerManager.clearProjectFiles();
    };
  }, []);

  // Subscribe to manager state changes for status updates
  useEffect(() => {
    const unsubscribe = WebContainerManager.subscribe((event) => {
      if (event.type === "state-change" && event.state) {
        // Update status based on manager state
        setStatus(getStatusFromManagerState());

        // Update preview URL if it changed
        if (event.state.previewUrl !== previewUrl) {
          setPreviewUrl(event.state.previewUrl);
        }
      }

      if (event.type === "console-errors" && event.state) {
        setConsoleErrors([...event.state.consoleErrors]);
      }
    });

    return unsubscribe;
  }, [previewUrl]);

  // Mount files when they change — only mounts files whose content actually differs.
  useEffect(() => {
    if (!files || Object.keys(files).length === 0) {
      return;
    }

    const fileMapTyped = files as Website.FileMap;
    const isInitialMount = mountedFilesRef.current === null;
    const changedFiles = diffFileMap(mountedFilesRef.current, fileMapTyped);

    if (!changedFiles) {
      if (import.meta.env.DEV) {
        console.log("[useWebsitePreview] files unchanged — skipping mount", {
          fileCount: Object.keys(files).length,
        });
      }
      return;
    }

    const changedKeys = Object.keys(changedFiles);

    if (import.meta.env.DEV) {
      console.log("[useWebsitePreview] files changed", {
        totalFiles: Object.keys(files).length,
        changedFiles: changedKeys.length,
        changedKeys,
        isInitialMount,
        previousStatus: status,
      });
    }

    // Update ref SYNCHRONOUSLY so subsequent effect invocations (from rapid
    // streaming patches) see the latest files and skip duplicate mounts.
    // Reverted on error so the next attempt retries.
    const previousFiles = mountedFilesRef.current;
    mountedFilesRef.current = fileMapTyped;

    async function mountFiles() {
      const mountStart = performance.now();
      try {
        // For initial mount or cold container, show loading status.
        // For incremental updates on a warm container, skip status change
        // to keep the iframe mounted — Vite HMR handles the update.
        if (isInitialMount || !WebContainerManager.isWarm()) {
          const newStatus = WebContainerManager.isWarm() ? "mounting" : getStatusFromManagerState();
          setStatus(newStatus);
          if (import.meta.env.DEV) {
            console.log("[useWebsitePreview] status transition →", newStatus);
          }
        } else if (import.meta.env.DEV) {
          console.log("[useWebsitePreview] incremental update — keeping iframe mounted");
        }

        // Always inject preview readiness script when index.html is present.
        // On initial mount, inject into the full file set.
        // On incremental updates, inject into changed files (if index.html changed).
        // This ensures the script survives AI edits to index.html + Vite full reloads.
        let filesToMount: Website.FileMap;
        if (isInitialMount) {
          filesToMount = injectPreviewReadinessScript(fileMapTyped);
        } else if (changedFiles) {
          filesToMount = injectPreviewReadinessScript(changedFiles);
        } else {
          return;
        }

        const fileTree = convertFileMapToFileSystemTree(filesToMount);

        let mergedTree = fileTree;
        if (isInitialMount && !hasPackageJson(fileMapTyped)) {
          const packageJson = createStaticSitePackageJson();
          mergedTree = mergeFileSystemTrees(fileTree, packageJson);
        }

        // Load project - this waits for warmup if needed, then mounts files
        const url = await WebContainerManager.loadProject(mergedTree);

        setPreviewUrl(url);
        if (isInitialMount || !WebContainerManager.isWarm()) {
          setStatus("ready");
        }

        if (import.meta.env.DEV) {
          const elapsed = (performance.now() - mountStart).toFixed(0);
          console.log(`[useWebsitePreview] mount complete (${elapsed}ms)`, {
            isInitialMount,
            changedFiles: changedKeys.length,
            totalFiles: Object.keys(files).length,
          });
        }
      } catch (err) {
        // Revert ref so the next effect invocation retries these files
        mountedFilesRef.current = previousFiles;
        console.error("WebContainer error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    }

    mountFiles();
  }, [files]);

  return {
    previewUrl,
    status,
    error,
    consoleErrors,
    reload,
  };
}
