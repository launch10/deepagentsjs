import type { PreviewMessage } from "@webcontainer/api";
import { PreviewMessageType } from "@webcontainer/api";
import type { Website } from "@shared";

type ConsoleError = Website.Errors.ConsoleError;

/**
 * Strip ANSI escape codes from terminal output.
 */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1B(?:\[[0-9;]*[a-zA-Z]|\].*?\x07|\[[\?]?[0-9;]*[a-zA-Z])/g;
function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/**
 * Check if Vite output indicates a successful rebuild (HMR update or page reload).
 * When Vite reports these, any previous build errors have been resolved.
 */
export function isSuccessfulRebuild(text: string): boolean {
  const clean = stripAnsi(text);
  return /\[vite\] (hmr update|page reload)/.test(clean);
}

/**
 * Noise patterns — stderr lines we always ignore.
 */
const NOISE_PATTERNS = [
  /ExperimentalWarning.*Type Stripping/i,
  /Use `node --trace-warnings/i,
  /DeprecationWarning/i,
];

/**
 * Patterns that match individual error blocks within a chunk.
 * Applied to ANSI-stripped text. Each returns a ConsoleError or null.
 */
interface ErrorMatcher {
  /** Quick test to avoid expensive regex on non-matching text */
  test: RegExp;
  /** Extract error details from the matched text */
  extract: (text: string) => Partial<ConsoleError> | null;
}

const ERROR_MATCHERS: ErrorMatcher[] = [
  // Vite "No matching export" — export_mismatch
  {
    test: /No matching export in "([^"]+)" for import "([^"]+)"/,
    extract: (text) => {
      const m = text.match(/No matching export in "([^"]+)" for import "([^"]+)"/);
      if (!m) return null;
      return {
        type: "error",
        message: `No matching export in "${m[1]}" for import "${m[2]}"`,
        file: m[1],
      };
    },
  },
  // Vite "Failed to resolve import ... from ..."
  {
    test: /Failed to resolve import "([^"]+)" from "([^"]+)"/,
    extract: (text) => {
      const m = text.match(/Failed to resolve import "([^"]+)" from "([^"]+)"/);
      if (!m) return null;
      return {
        type: "error",
        message: `Failed to resolve import "${m[1]}" from "${m[2]}"`,
        file: m[2],
      };
    },
  },
  // SyntaxError
  {
    test: /SyntaxError:/,
    extract: (text) => ({
      type: "error",
      message: cleanMessage(text),
    }),
  },
  // Pre-transform error
  {
    test: /Pre-transform error:/,
    extract: (text) => ({
      type: "error",
      message: cleanMessage(text),
    }),
  },
  // Vite warning
  {
    test: /\[vite\] warning:/,
    extract: (text) => ({
      type: "warning",
      message: cleanMessage(text),
    }),
  },
];

/**
 * Strip common prefixes from error messages to get the actionable content.
 */
function cleanMessage(text: string): string {
  return text
    .split("\n")[0]
    .replace(/^\d+:\d+:\d+\s*(AM|PM)\s*/i, "")
    .replace(/^\[vite\]\s*/i, "")
    .replace(/^Internal server error:\s*/i, "")
    .replace(/^Pre-transform error:\s*/i, "")
    .replace(/^warning:\s*/i, "")
    .trim();
}

/**
 * Split a chunk into individual esbuild error blocks.
 * esbuild prefixes each error with "✘ [ERROR]".
 * A single chunk from the WebContainer output stream can contain many.
 */
function splitEsbuildErrors(text: string): string[] {
  // Split on "✘ [ERROR]" keeping the delimiter with the text after it
  const parts = text.split(/(?=✘ \[ERROR\])/);
  return parts.filter((p) => p.includes("✘ [ERROR]"));
}

/**
 * esbuild messages that are transient noise, not actionable errors.
 * "The build was canceled" fires when rapid file changes abort an in-progress build.
 */
const ESBUILD_NOISE = [/^The build was canceled$/i];

/**
 * Parse a single esbuild error block into a ConsoleError, or null for noise.
 */
function parseEsbuildBlock(block: string): ConsoleError | null {
  // First line: ✘ [ERROR] <message>
  const firstLine = block.split("\n")[0].replace(/^✘ \[ERROR\]\s*/, "").trim();

  // Skip transient esbuild messages (e.g. build cancellation during rapid file writes)
  if (ESBUILD_NOISE.some((p) => p.test(firstLine))) return null;

  // Try to extract file from the error message itself first
  // e.g. No matching export in "src/components/Problem.tsx" for import "Problem"
  const messageFileMatch = firstLine.match(/in "([^"]+\.(?:tsx?|jsx?|css|html))"/);

  // Fallback: file + line from the location line: "    src/pages/IndexPage.tsx:2:9:"
  const locationMatch = block.match(/^\s+([\w/.@-]+\.(?:tsx?|jsx?|css|html)):(\d+):\d+:/m);

  // Code frame: lines with │ or ╵
  const frameLines = block
    .split("\n")
    .filter((l) => /[│╵|]/.test(l))
    .join("\n");

  return {
    type: "error",
    message: firstLine,
    file: messageFileMatch?.[1] ?? locationMatch?.[1],
    frame: frameLines || undefined,
    timestamp: new Date(),
  };
}

/**
 * Parse a chunk of Vite/esbuild output into ConsoleError[].
 *
 * Pure function — easy to test, no side effects.
 * Returns an empty array for normal (non-error) output.
 */
export function parseBuildErrors(text: string): ConsoleError[] {
  const clean = stripAnsi(text);
  if (!clean.trim()) return [];

  // Filter noise
  if (NOISE_PATTERNS.some((p) => p.test(clean))) return [];

  const errors: ConsoleError[] = [];

  // 1. Extract all esbuild "✘ [ERROR]" blocks (a chunk can contain many)
  const esbuildBlocks = splitEsbuildErrors(clean);
  for (const block of esbuildBlocks) {
    const parsed = parseEsbuildBlock(block);
    if (parsed) errors.push(parsed);
  }

  // 2. If we found esbuild errors, also check for the "Failed to scan" wrapper
  //    but don't double-count — just return the specific errors
  if (errors.length > 0) {
    return errors;
  }

  // 3. Try the other matchers (Vite-level errors, syntax errors, warnings)
  for (const matcher of ERROR_MATCHERS) {
    if (matcher.test.test(clean)) {
      const partial = matcher.extract(clean);
      if (partial) {
        errors.push({
          type: partial.type ?? "error",
          message: partial.message ?? clean.split("\n")[0],
          file: partial.file,
          frame: partial.frame,
          timestamp: new Date(),
        });
        return errors;
      }
    }
  }

  // 4. Catch "Failed to scan for dependencies" when it appears alone (no esbuild blocks)
  if (/Failed to scan for dependencies/.test(clean)) {
    errors.push({
      type: "error",
      message: "Failed to scan for dependencies",
      timestamp: new Date(),
    });
  }

  return errors;
}

/**
 * Result of processing a single chunk of Vite dev server output.
 * Encapsulates both error detection and rebuild success detection in one pass.
 */
export interface ViteChunkResult {
  /** New build errors found in this chunk */
  errors: ConsoleError[];
  /** True if this chunk signals a successful rebuild (HMR/reload), meaning stale errors are resolved */
  clearsErrors: boolean;
}

/**
 * Process a chunk of Vite dev server output: parse errors AND detect rebuild success.
 *
 * This is the core logic for the stale-error-clearing fix. When Vite outputs
 * an error during incremental file writes (e.g. missing import while files are
 * being written one-by-one), then later outputs an HMR update or page reload,
 * the rebuild success signal tells us the earlier errors are resolved.
 *
 * Rules:
 * - If the chunk contains errors, `clearsErrors` is always false (new errors take priority)
 * - If the chunk contains no errors but IS a rebuild signal, `clearsErrors` is true
 * - Otherwise, `clearsErrors` is false (normal non-error, non-rebuild output)
 */
export function processViteChunk(text: string): ViteChunkResult {
  const errors = parseBuildErrors(text);
  return {
    errors,
    // Only signal clear if there are NO new errors in this chunk.
    // A chunk with both errors and a rebuild signal means the rebuild itself failed.
    clearsErrors: errors.length === 0 && isSuccessfulRebuild(text),
  };
}

/**
 * Map a WebContainer PreviewMessage to our shared ConsoleError type.
 *
 * PreviewMessage comes from the `preview-message` event on the WebContainer
 * instance (requires `forwardPreviewErrors: true` at boot).
 */
export function parsePreviewMessage(msg: PreviewMessage): ConsoleError {
  switch (msg.type) {
    case PreviewMessageType.UncaughtException:
    case PreviewMessageType.UnhandledRejection:
      return {
        type: "error",
        message: msg.message,
        stack: msg.stack,
        timestamp: new Date(),
      };
    case PreviewMessageType.ConsoleError:
      return {
        type: "error",
        message: msg.args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
        stack: msg.stack,
        timestamp: new Date(),
      };
  }
}
