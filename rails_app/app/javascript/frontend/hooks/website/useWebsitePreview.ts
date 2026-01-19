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

const DEBUG = true; // Enable console logging for WebContainer output

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
        if (DEBUG) {
          console.log("[WebContainer] Converting files to FileSystemTree...");
          console.log("[WebContainer] File count:", Object.keys(fileMapTyped).length);
          console.log("[WebContainer] Has package.json:", hasPackageJson(fileMapTyped));
        }
        const fileTree = convertFileMapToFileSystemTree(fileMapTyped);

        // Only add fallback package.json if files don't include one
        let mergedTree = fileTree;
        if (!hasPackageJson(fileMapTyped)) {
          console.log("[WebContainer] No package.json found, adding static site fallback");
          const packageJson = createStaticSitePackageJson();
          mergedTree = mergeFileSystemTrees(fileTree, packageJson);
        } else {
          console.log("[WebContainer] Using package.json from files (Vite/React project)");
        }

        if (DEBUG) {
          console.log("[WebContainer] Final tree root keys:", Object.keys(mergedTree));
        }
        await wc.mount(mergedTree);
        console.log("[WebContainer] Files mounted successfully");
        mountedFilesRef.current = filesKey;

        // Only start dev server once
        if (!devServerStartedRef.current) {
          devServerStartedRef.current = true;

          // Log mounted files for debugging
          if (DEBUG) {
            console.log("[WebContainer] Mounted files:", Object.keys(files as Website.FileMap));
          }

          // Install dependencies
          setStatus("installing");
          console.log("[WebContainer] Running npm install...");
          const installProcess = await wc.spawn("npm", ["install"]);
          pipeToConsole(installProcess, "npm-install");
          const installExitCode = await installProcess.exit;
          console.log("[WebContainer] npm install exit code:", installExitCode);

          if (installExitCode !== 0) {
            throw new Error(`npm install failed with exit code ${installExitCode}`);
          }

          // Start dev server
          setStatus("starting");
          console.log("[WebContainer] Running npm run dev...");
          const devProcess = await wc.spawn("npm", ["run", "dev"]);
          pipeToConsole(devProcess, "dev-server");

          // Listen for port events
          wc.on("port", (port, type, url) => {
            console.log(`[WebContainer] Port event: port=${port}, type=${type}, url=${url}`);
            if (type === "open") {
              setPreviewUrl(url);
              setStatus("ready");
            } else if (type === "close") {
              // Server stopped, could retry
              setPreviewUrl(null);
              setStatus("idle");
            }
          });
        } else {
          // Files updated, just trigger a reload
          // The dev server (serve) will pick up the new files
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
