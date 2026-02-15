import { Polly, type PollyConfig } from "@pollyjs/core";
import NodeHttpAdapter from "@pollyjs/adapter-node-http";
import FetchAdapter from "@pollyjs/adapter-fetch";
import FSPersister from "@pollyjs/persister-fs";
import path from "path";

// Register Polly adapters and persisters once globally
Polly.register(NodeHttpAdapter);
Polly.register(FetchAdapter);
Polly.register(FSPersister);

/**
 * Normalize request body for deterministic Polly matching.
 *
 * Handles two sources of non-determinism:
 * 1. Absolute paths (machine-specific /Users/brett/... vs /home/circleci/...)
 * 2. cache_control fields (added by prompt caching middleware, absent in older recordings)
 */
function normalizeBodyForMatching(body: unknown): string {
  // Handle non-string bodies (objects, Buffers, undefined, etc.)
  if (body === null || body === undefined) {
    return "";
  }

  // Convert to string if needed
  let bodyStr: string;
  if (typeof body === "string") {
    bodyStr = body;
  } else if (Buffer.isBuffer(body)) {
    bodyStr = body.toString("utf-8");
  } else if (typeof body === "object") {
    try {
      bodyStr = JSON.stringify(body);
    } catch {
      return "";
    }
  } else {
    return String(body);
  }

  if (!bodyStr) return bodyStr;

  // 1. Normalize absolute paths
  const absolutePathPattern = /(?:\/[^\/\s"'\\]+)+\/langgraph_app\//g;
  const windowsPathPattern = /(?:[A-Za-z]:\\[^\\"\s]+\\)+langgraph_app\\/g;

  let normalized = bodyStr.replace(absolutePathPattern, "/PROJECT_ROOT/langgraph_app/");
  normalized = normalized.replace(windowsPathPattern, "/PROJECT_ROOT/langgraph_app/");

  // 2. Strip cache_control fields so recordings match regardless of prompt caching.
  //    The middleware adds {"type":"ephemeral","ttl":"5m"} to tools and messages,
  //    but older recordings have cache_control:null or omit it entirely.
  normalized = normalized.replace(/"cache_control":\s*\{[^}]*\}/g, '"cache_control":null');

  return normalized;
}

// Keep old name as alias for backward compatibility in beforePersist handler
const normalizePathsInBody = normalizeBodyForMatching;

// Use global to ensure singleton across module boundaries
// This is necessary because TypeScript path aliases can cause module duplication
const globalAny = global as any;
if (!globalAny.__pollyManagerInstance) {
  globalAny.__pollyManagerInstance = null;
}
if (globalAny.__pollyDisabled === undefined) {
  globalAny.__pollyDisabled = false;
}

class PollyManager {
  static get polly(): Polly | null {
    return globalAny.__pollyManagerInstance;
  }

  static set polly(value: Polly | null) {
    globalAny.__pollyManagerInstance = value;
  }

  static get disabled(): boolean {
    return globalAny.__pollyDisabled;
  }

  static set disabled(value: boolean) {
    globalAny.__pollyDisabled = value;
  }

  static disable(): void {
    PollyManager.disabled = true;
  }

  static enable(): void {
    PollyManager.disabled = false;
  }

  // Hosts that should always be passed through (never recorded/replayed)
  static PASSTHROUGH_HOSTS = [
    "https://api.smith.langchain.com", // LangSmith tracing
  ];

  static RECORDINGS_DIR = path.join(process.cwd(), "tests", "recordings");

  /**
   * Gets or creates a Polly instance for a specific node.
   * This is designed to be called by node decorators.
   *
   * @param nodeName The name of the node (used for recording name)
   * @param options Additional options for the node
   * @returns The Polly instance (either existing or newly created)
   */
  public static async startPolly(
    recordingName: string,
    mode?: "record" | "replay" | "passthrough" | "stopped",
    configure?: (polly: Polly) => void
  ): Promise<void> {
    if (PollyManager.disabled) {
      return;
    }
    let polly = PollyManager.polly;
    if (!polly) {
      polly = PollyManager.hardStartPolly({
        recordingName,
        mode,
        configure,
      });
    }
    PollyManager.setRecordingName(recordingName);
  }

  /**
   * Gets the current Polly instance if one exists.
   */
  public static getPolly(): Polly | null {
    return PollyManager.polly;
  }

  /**
   * Stops and cleans up the global Polly instance.
   */
  public static async stopPolly(): Promise<void> {
    if (PollyManager.disabled) {
      return;
    }
    if (PollyManager.polly) {
      if (PollyManager.polly.persister) {
        await PollyManager.polly.persister.persist();
      }
      await PollyManager.polly.stop();
      PollyManager.polly = null;
    }
  }

  /**
   * Persists all recordings for the active Polly instance.
   */
  public static async persistRecordings(): Promise<void> {
    if (PollyManager.disabled) {
      return;
    }
    await PollyManager.polly?.persister?.persist();
  }

  /**
   * Configures request routing for a specific node.
   * Only updates AI/LLM host routes to use node-specific recordings.
   * This preserves any test-specific configuration for other routes.
   *
   * @param nodeName The name of the node (used for recording name)
   */
  public static setRecordingName(nodeName: string): void {
    const polly = PollyManager.polly;
    if (!polly) {
      throw new Error("No active Polly instance to configure");
    }

    const { server } = polly;

    server.any().recordingName(nodeName);
  }

  /**
   * Monkey-patch the persister's findEntry to use O(1) Map lookup
   * instead of O(n) Array.find(). Polly already computes an MD5 hash
   * per request and stores it as entry._id in HAR files, but findEntry
   * does a linear scan. We build a Map index on first access per recording.
   *
   * Uses a WeakMap keyed by the recording object so the index is
   * automatically GC'd when the recording is evicted from Polly's cache.
   */
  private static patchFindEntry(): void {
    const persister = PollyManager.polly?.persister as any;
    if (!persister) return;

    const entryIndex = new WeakMap<object, Map<string, any>>();

    persister.findEntry = async function (pollyRequest: any) {
      const { id, order, recordingId } = pollyRequest;
      const recording = await this.findRecording(recordingId);
      if (!recording) return null;

      if (!entryIndex.has(recording)) {
        const index = new Map<string, any>();
        for (const entry of recording.log.entries) {
          const key = `${entry._id}_${entry._order}`;
          if (!index.has(key)) {
            index.set(key, entry);
          }
        }
        entryIndex.set(recording, index);
      }

      return entryIndex.get(recording)!.get(`${id}_${order}`) || null;
    };
  }

  private static configurePassthroughs() {
    const { server } = PollyManager.polly!;

    // Passthrough to Rails on whatever port it's running (from config/services.sh)
    const railsPort = process.env.RAILS_PORT || "3000";
    server.any(`http://localhost:${railsPort}/*path`).passthrough();

    // Passthrough hosts that should never be recorded.
    // IMPORTANT: Polly's server.any() does NOT support regex — it uses route-recognizer
    // for string URL patterns only. Use server.host() for host-based matching.
    PollyManager.PASSTHROUGH_HOSTS.forEach((host) => {
      server.host(host, () => {
        server.any("/*path").passthrough();
      });
    });
  }

  private static configureRequestLogging() {
    const { server } = PollyManager.polly!;

    // Log every HTTP request Polly intercepts so we can debug passthrough issues
    server.any().on("beforeResponse", (req: any) => {
      const action = req.action?.toUpperCase() || "UNKNOWN";
      const status = req.response?.statusCode ?? "?";
      let line = `[Polly ${action}] ${req.method} ${req.url} → ${status}`;

      // For POST/PUT/PATCH, show a truncated body snippet
      if (req.body && ["POST", "PUT", "PATCH"].includes(req.method)) {
        const bodyStr = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        const snippet = bodyStr.length > 200 ? bodyStr.slice(0, 200) + "…" : bodyStr;
        line += ` body=${snippet}`;
      }

      console.log(line);
    });
  }

  /**
   * Only persist successful (2xx) responses. Any non-2xx response is transient
   * (auth errors, rate limits, server errors, bad requests) and would poison
   * the recording — causing infinite retry loops or permanent test failures.
   */
  private static isPoisonedResponse(recording: any): boolean {
    const status = recording.response?.status;
    if (typeof status !== "number") return true;
    return status < 200 || status >= 300;
  }

  private static configureHeaders() {
    const { server } = PollyManager.polly!;
    server.any().on("beforePersist", (req: any, recording: any) => {
      // Drop poisoned responses so they never get saved to HAR files.
      // Polly will treat these as missing on next run and re-record them.
      if (PollyManager.isPoisonedResponse(recording)) {
        // Setting the response to undefined causes Polly to skip persisting this entry
        recording.response = undefined;
        return;
      }

      const headersToIgnore = [
        "x-api-key",
        "authorization",
        "api-key",
        "x-test-proof",
        "x-test-mode",
        "anthropic-ratelimit-input-tokens-limit",
        "anthropic-ratelimit-input-tokens-remaining",
        "anthropic-ratelimit-input-tokens-reset",
        "x-stainless-os",
        "x-stainless-arch",
        "x-stainless-runtime-version",
      ];
      // Remove sensitive headers from recorded request
      if (
        recording.request &&
        recording.request.headers &&
        Array.isArray(recording.request.headers)
      ) {
        recording.request.headers = recording.request.headers.filter((header: any) => {
          const name = header.name?.toLowerCase();
          return !headersToIgnore.includes(name);
        });
      }
      // Also check for headers at the top level
      if (recording.headers && Array.isArray(recording.headers)) {
        recording.headers = recording.headers.filter((header: any) => {
          const name = header.name?.toLowerCase();
          return !headersToIgnore.includes(name);
        });
      }

      // Normalize absolute paths in request body for deterministic recordings
      // This ensures recordings work across different machines/environments
      if (recording.request?.postData?.text) {
        recording.request.postData.text = normalizePathsInBody(recording.request.postData.text);
      }
    });
  }

  /**
   * Gets or creates a Polly instance.
   * - If no Polly exists, creates a new one with the given options
   * - If a Polly exists with the SAME recording name, returns it (optionally applying additional config)
   * - If a Polly exists with a DIFFERENT recording name, returns the existing one WITHOUT changing it
   *   (This allows nodes to share a test-level Polly instance)
   */
  private static hardStartPolly(options: {
    recordingName: string;
    mode?: "record" | "replay" | "passthrough" | "stopped";
    configure?: (polly: Polly) => void;
  }): Polly {
    PollyManager.polly = new Polly(options.recordingName, {
      mode: options.mode || "replay",
      adapters: ["node-http", "fetch"],
      persister: "fs",
      persisterOptions: {
        fs: {
          recordingsDir: PollyManager.RECORDINGS_DIR,
        },
        keepUnusedRequests: false, // Safe: recordings are namespaced per test file
      },
      recordIfMissing: !process.env.CI,
      matchRequestsBy: {
        method: true,
        headers: false,
        // Custom body matcher that normalizes absolute paths for deterministic matching
        body: (body: string) => normalizePathsInBody(body),
        order: false,
        url: true,
      },
      recordFailedRequests: false,
      logLevel: "silent",
    });
    PollyManager.configurePassthroughs();
    PollyManager.configureRequestLogging();
    PollyManager.configureHeaders();
    PollyManager.patchFindEntry();

    // --- ALLOW CUSTOM CONFIGURATION BEFORE DEFAULT HANDLERS ---
    if (options.configure) {
      options.configure(PollyManager.polly);
    }

    return PollyManager.polly;
  }
}

/**
 * Mock API response helper for tests
 */
export function mockApiResponse(pattern: string | RegExp, response: any) {
  const polly = PollyManager.getPolly();
  if (!polly) {
    throw new Error("No active Polly instance. Call startPolly first.");
  }

  polly.server
    .any(pattern as any) // regex seems to be permitted, not sure why not it's typed wrong
    .intercept((req: any, res: any) => {
      res.status(response.status || 200);
      res.json(response.body || response);
    });
}

/**
 * Mock multiple API endpoints at once
 */
export function mockApiEndpoints(endpoints: Array<{ pattern: string | RegExp; response: any }>) {
  endpoints.forEach(({ pattern, response }) => {
    mockApiResponse(pattern, response);
  });
}

export const {
  startPolly,
  stopPolly,
  persistRecordings,
  getPolly,
  disable: disablePolly,
  enable: enablePolly,
} = PollyManager;
