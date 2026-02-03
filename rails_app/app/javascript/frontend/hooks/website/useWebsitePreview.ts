import { useState, useEffect, useRef, useCallback } from "react";
import {
  WebContainerManager,
  convertFileMapToFileSystemTree,
  createStaticSitePackageJson,
  mergeFileSystemTrees,
  hasPackageJson,
  type WebContainerStatus,
} from "@lib/webcontainer";
import { useWebsiteChatState } from "./useWebsiteChat";
import type { Website } from "@shared";

interface UseWebsitePreviewReturn {
  previewUrl: string | null;
  status: WebContainerStatus;
  error: string | null;
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

  const mountedFilesRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Reload the preview iframe
  const reload = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

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
    });

    return unsubscribe;
  }, [previewUrl]);

  // Mount files when they change
  useEffect(() => {
    if (!files || Object.keys(files).length === 0) {
      return;
    }

    // Skip if files haven't changed
    const filesKey = JSON.stringify(files);
    if (mountedFilesRef.current === filesKey) {
      return;
    }

    async function mountFiles() {
      try {
        // If container is not yet warm, update status to show progress
        if (!WebContainerManager.isWarm()) {
          setStatus(getStatusFromManagerState());
        } else {
          setStatus("mounting");
        }

        // Convert files to FileSystemTree
        const fileMapTyped = files as Website.FileMap;
        const fileTree = convertFileMapToFileSystemTree(fileMapTyped);

        // Only add fallback package.json if files don't include one
        let mergedTree = fileTree;
        if (!hasPackageJson(fileMapTyped)) {
          const packageJson = createStaticSitePackageJson();
          mergedTree = mergeFileSystemTrees(fileTree, packageJson);
        }

        // Load project - this waits for warmup if needed, then mounts files
        const url = await WebContainerManager.loadProject(mergedTree);
        mountedFilesRef.current = filesKey;

        setPreviewUrl(url);
        setStatus("ready");
      } catch (err) {
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
    reload,
  };
}
