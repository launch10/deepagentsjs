import { useState, useEffect, useRef, useCallback } from "react";
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import {
  webcontainer,
  convertFileMapToFileSystemTree,
  createStaticSitePackageJson,
  mergeFileSystemTrees,
  hasPackageJson,
  type WebContainerStatus,
} from "@lib/webcontainer";
import { useWebsiteChatState } from "./useWebsiteChat";
import type { Website } from "@shared";

const DEBUG = false; // Enable console logging for WebContainer output

/**
 * Pipes process output to console for debugging
 */
function pipeToConsole(process: WebContainerProcess, prefix: string) {
  if (!DEBUG) return;

  process.output.pipeTo(
    new WritableStream({
      write(chunk) {
        // Split by newlines and log each line with prefix
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            console.log(`[WebContainer:${prefix}]`, line);
          }
        }
      },
    })
  );
}

interface UseWebsitePreviewReturn {
  previewUrl: string | null;
  status: WebContainerStatus;
  error: string | null;
  reload: () => void;
}

/**
 * Hook that manages the WebContainer lifecycle for website preview.
 * Listens to files from langgraph state and mounts them to WebContainer.
 */
export function useWebsitePreview(): UseWebsitePreviewReturn {
  const files = useWebsiteChatState("files");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<WebContainerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const webcontainerRef = useRef<WebContainer | null>(null);
  const devServerStartedRef = useRef(false);
  const mountedFilesRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Reload the preview iframe
  const reload = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  // Mount files and start dev server
  useEffect(() => {
    if (!files || Object.keys(files).length === 0) {
      return;
    }

    // Skip if files haven't changed
    const filesKey = JSON.stringify(files);
    if (mountedFilesRef.current === filesKey && devServerStartedRef.current) {
      return;
    }

    async function mountAndRun() {
      try {
        // Boot WebContainer if not already booted
        if (!webcontainerRef.current) {
          setStatus("booting");
          webcontainerRef.current = await webcontainer;
        }

        const wc = webcontainerRef.current;

        // Convert files to FileSystemTree and mount
        setStatus("mounting");
        const fileMapTyped = files as Website.FileMap;
        const fileTree = convertFileMapToFileSystemTree(fileMapTyped);

        // Only add fallback package.json if files don't include one
        let mergedTree = fileTree;
        if (!hasPackageJson(fileMapTyped)) {
          const packageJson = createStaticSitePackageJson();
          mergedTree = mergeFileSystemTrees(fileTree, packageJson);
        }

        await wc.mount(mergedTree);
        mountedFilesRef.current = filesKey;

        // Only start dev server once
        if (!devServerStartedRef.current) {
          devServerStartedRef.current = true;

          // Install dependencies
          setStatus("installing");
          const installProcess = await wc.spawn("npm", ["install"]);
          pipeToConsole(installProcess, "npm-install");
          const installExitCode = await installProcess.exit;

          if (installExitCode !== 0) {
            throw new Error(`npm install failed with exit code ${installExitCode}`);
          }

          // Start dev server
          setStatus("starting");
          const devProcess = await wc.spawn("npm", ["run", "dev"]);
          pipeToConsole(devProcess, "dev-server");

          // Listen for port events
          wc.on("port", (port, type, url) => {
            if (type === "open") {
              setPreviewUrl(url);
              setStatus("ready");
            } else if (type === "close") {
              setPreviewUrl(null);
              setStatus("idle");
            }
          });
        } else {
          // Files updated, just trigger a reload
          setStatus("ready");
        }
      } catch (err) {
        console.error("WebContainer error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setStatus("error");
      }
    }

    mountAndRun();
  }, [files]);

  return {
    previewUrl,
    status,
    error,
    reload,
  };
}
