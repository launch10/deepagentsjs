import { FileExporter } from "../core/fileExporter";
import { WebsiteRunner } from "../core/websiteRunner";
import { BrowserErrorCapture } from "./browserErrorCapture";
import type { ConsoleError, CombinedErrors, HasErrorsOptions } from "@types";
import { getLogger } from "@core";

/**
 * Patterns to filter out from server errors (noise, not actionable)
 */
const SERVER_NOISE_PATTERNS = [
  /ExperimentalWarning.*Type Stripping/i,
  /Use `node --trace-warnings/i,
  /DeprecationWarning/i,
];

/**
 * Strip ANSI color codes from text
 */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Clean file path - extract relative src path from temp directory paths
 */
function cleanFilePath(filePath: string): string {
  // Match patterns like /tmp/.../src/pages/IndexPage.tsx or /var/folders/.../src/...
  const srcMatch = filePath.match(/\/(src\/[^\s:]+)/);
  if (srcMatch?.[1]) return srcMatch[1];

  // Also try matching just the filename if no src/ found
  const fileMatch = filePath.match(/\/([^/]+\.(tsx?|jsx?|css|html))$/i);
  if (fileMatch?.[1]) return fileMatch[1];

  return filePath;
}

/**
 * Extract file path and line number from error message
 */
function extractFileInfo(text: string): { file?: string; line?: number } {
  // Match patterns like "src/pages/IndexPage.tsx:6:9" or "File: /path/to/file.tsx"
  const patterns = [
    // Standard file:line:col format
    /(?:File:\s*)?([^\s:]+\.tsx?):(\d+)(?::\d+)?/i,
    // Vite/ESBuild format: ,-[/path/to/file.tsx:6:9]
    /,-\[([^\]]+):(\d+):\d+\]/,
    // Code frame format: 6 │ or 6 |
    /^\s*(\d+)\s*[│|]/m,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // Code frame pattern only gives line number, not file
      if (pattern.source.includes("[│|]")) {
        // Try to find file from other patterns first
        for (const filePattern of patterns.slice(0, 2)) {
          const fileMatch = text.match(filePattern);
          if (fileMatch?.[1] && match[1]) {
            return { file: cleanFilePath(fileMatch[1]), line: parseInt(match[1], 10) };
          }
        }
        // Just return line if no file found
        if (match[1]) {
          return { line: parseInt(match[1], 10) };
        }
      }
      if (match[1] && match[2]) {
        return { file: cleanFilePath(match[1]), line: parseInt(match[2], 10) };
      }
    }
  }

  // Try to find just the file if no line number
  const fileOnlyMatch = text.match(/([^\s:]+\.tsx?)(?::|$|\s)/i);
  if (fileOnlyMatch?.[1]) {
    return { file: cleanFilePath(fileOnlyMatch[1]) };
  }

  return {};
}

/**
 * Check if server error line is noise (not actionable)
 */
function isServerNoise(line: string): boolean {
  return SERVER_NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Check if browser error is a symptom of build failure (not root cause)
 */
function isBrowserSymptom(error: ConsoleError, hasBuildErrors: boolean): boolean {
  if (!hasBuildErrors) return false;

  // 500 errors and request failures are symptoms when we have build errors
  const symptomPatterns = [
    /status of 500/i,
    /net::ERR_ABORTED/i,
    /Failed to load resource/i,
    /Request failed/i,
  ];

  return symptomPatterns.some((pattern) => pattern.test(error.message));
}

/**
 * Classify error type for deduplication
 */
function classifyErrorType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("expected") || lower.includes("unexpected") || lower.includes("syntax")) {
    return "syntax";
  }
  if (
    lower.includes("cannot find") ||
    lower.includes("not found") ||
    lower.includes("does not exist")
  ) {
    return "notfound";
  }
  if (lower.includes("type") && (lower.includes("error") || lower.includes("mismatch"))) {
    return "type";
  }
  if (lower.includes("import") || lower.includes("module") || lower.includes("dependencies")) {
    return "import";
  }
  return "other";
}

/**
 * Deduplicate errors by file + line (primary) or file + error type (fallback)
 *
 * The same underlying error often appears differently across sources:
 * - Vite: "Expected ',', got 'ident'"
 * - ESBuild: "Expected ')' but found 'className'"
 * - Server: "Failed to scan for dependencies"
 *
 * All refer to the same syntax error at the same location, so we dedupe by location.
 */
function getErrorSignature(text: string): string {
  const clean = stripAnsi(text);
  const fileInfo = extractFileInfo(clean);

  // Best case: file + line number (most reliable)
  if (fileInfo.file && fileInfo.line) {
    return `${fileInfo.file}:${fileInfo.line}`;
  }

  // Fallback: file + error type classification
  if (fileInfo.file) {
    const errorType = classifyErrorType(clean);
    return `${fileInfo.file}:${errorType}`;
  }

  // Last resort: classify by error type + first significant line
  const errorType = classifyErrorType(clean);
  const lines = clean.split("\n").filter((l) => l.trim());
  const firstLine = (lines[0] || "").slice(0, 50);
  return `unknown:${errorType}:${firstLine}`;
}

interface ParsedError {
  type: "build" | "runtime" | "warning";
  file?: string;
  line?: number;
  message: string;
  codeFrame?: string;
  source: "vite-overlay" | "server" | "browser";
}

/**
 * Parse and normalize errors from all sources
 */
function parseErrors(
  browser: ConsoleError[],
  server: string[],
  viteOverlay: ConsoleError[]
): ParsedError[] {
  const errors: ParsedError[] = [];
  const seen = new Set<string>();

  // 1. Vite overlay errors (highest priority - most actionable)
  for (const error of viteOverlay) {
    const signature = getErrorSignature(error.message);
    if (seen.has(signature)) continue;
    seen.add(signature);

    const clean = stripAnsi(error.message);
    const fileInfo = extractFileInfo(error.file || error.message);

    // Extract code frame from message if present
    const frameMatch = clean.match(/(\d+\s*\|[^\n]+(?:\n[^\n]*\|[^\n]+)*)/);

    errors.push({
      type: "build",
      file: fileInfo.file || (error.file ? cleanFilePath(error.file) : undefined),
      line: fileInfo.line,
      message: extractCoreMessage(clean),
      codeFrame: frameMatch ? frameMatch[1] : undefined,
      source: "vite-overlay",
    });
  }

  // 2. Server errors (build/compilation errors)
  const hasBuildErrors = errors.length > 0;
  for (const line of server) {
    if (isServerNoise(line)) continue;

    const signature = getErrorSignature(line);
    if (seen.has(signature)) continue;
    seen.add(signature);

    const clean = stripAnsi(line);
    const fileInfo = extractFileInfo(clean);

    // Extract code frame if present
    const frameMatch = clean.match(/(\d+\s*[│|][^\n]+(?:\n[^\n]*[│|][^\n]+)*)/);

    errors.push({
      type: "build",
      file: fileInfo.file,
      line: fileInfo.line,
      message: extractCoreMessage(clean),
      codeFrame: frameMatch ? frameMatch[1] : undefined,
      source: "server",
    });
  }

  // 3. Browser errors (runtime errors - only if not symptoms of build failure)
  const hasBuildErrorsNow = errors.some((e) => e.type === "build");
  for (const error of browser) {
    if (isBrowserSymptom(error, hasBuildErrorsNow)) continue;

    const signature = getErrorSignature(error.message);
    if (seen.has(signature)) continue;
    seen.add(signature);

    errors.push({
      type: error.type === "warning" ? "warning" : "runtime",
      file: error.location ? cleanFilePath(error.location) : undefined,
      message: error.message,
      source: "browser",
    });
  }

  return errors;
}

/**
 * Extract the core error message from verbose output
 */
function extractCoreMessage(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Look for the main error description
  for (const line of lines) {
    // Skip lines that are just file paths or stack traces
    if (line.startsWith("at ")) continue;
    if (line.startsWith("File:")) continue;
    if (line.match(/^\d+\s*[│|]/)) continue; // Code frame lines
    if (line.match(/^[├└─│|]/)) continue; // Box drawing
    if (line.match(/^\s*\^+\s*$/)) continue; // Pointer lines

    // Found a meaningful line
    if (
      line.includes("Error") ||
      line.includes("error") ||
      line.includes("Expected") ||
      line.includes("Cannot")
    ) {
      // Clean up the message
      return line
        .replace(/^\[ERROR\]\s*/i, "")
        .replace(/^[x✘]\s*/i, "")
        .replace(/^\d+:\d+:\d+\s*(AM|PM)\s*\[vite\]\s*/i, "")
        .replace(/Internal server error:\s*/i, "")
        .replace(/Pre-transform error:\s*/i, "")
        .trim();
    }
  }

  // Fallback to first non-empty line
  return lines[0]?.slice(0, 200) || "Unknown error";
}

/**
 * Creates a CombinedErrors object with helper methods
 */
function createCombinedErrors(
  browser: ConsoleError[],
  server: string[],
  viteOverlay: ConsoleError[]
): CombinedErrors {
  return {
    browser,
    server,
    viteOverlay,
    hasErrors(options?: HasErrorsOptions): boolean {
      const { excludeWarnings = false } = options || {};

      // Filter server noise before checking
      const realServerErrors = server.filter((line) => !isServerNoise(line));
      if (realServerErrors.length > 0) return true;

      // Check Vite overlay errors (always count as errors)
      if (viteOverlay.length > 0) return true;

      // Check browser errors
      if (excludeWarnings) {
        return browser.some((e) => e.type === "error");
      }
      return browser.length > 0;
    },
    getFormattedReport(): string {
      const parsed = parseErrors(browser, server, viteOverlay);

      if (parsed.length === 0) {
        return "No errors detected.";
      }

      // Group by type
      const buildErrors = parsed.filter((e) => e.type === "build");
      const runtimeErrors = parsed.filter((e) => e.type === "runtime");
      const warnings = parsed.filter((e) => e.type === "warning");

      const sections: string[] = [];

      // Build errors first (most important)
      if (buildErrors.length > 0) {
        sections.push("## Build Errors\n");
        buildErrors.forEach((error, i) => {
          sections.push(`${i + 1}. ${error.message}`);
          if (error.file) {
            sections.push(`   File: ${error.file}${error.line ? `:${error.line}` : ""}`);
          }
          if (error.codeFrame) {
            sections.push(`   Code:`);
            error.codeFrame.split("\n").forEach((line) => {
              sections.push(`   ${line}`);
            });
          }
          sections.push("");
        });
      }

      // Runtime errors
      if (runtimeErrors.length > 0) {
        sections.push("## Runtime Errors\n");
        runtimeErrors.forEach((error, i) => {
          sections.push(`${i + 1}. ${error.message}`);
          if (error.file) {
            sections.push(`   Location: ${error.file}`);
          }
          sections.push("");
        });
      }

      // Warnings (lowest priority)
      if (warnings.length > 0) {
        sections.push("## Warnings\n");
        warnings.forEach((error, i) => {
          sections.push(`${i + 1}. ${error.message}`);
          sections.push("");
        });
      }

      return sections.join("\n").trim();
    },
  };
}

export class ErrorExporter implements AsyncDisposable {
  private websiteId: number;
  private runner?: WebsiteRunner;
  private errorCapture?: BrowserErrorCapture;
  private exporter?: FileExporter;

  constructor(websiteId: number) {
    this.websiteId = websiteId;
  }

  async run(): Promise<CombinedErrors> {
    const log = getLogger({ component: "ErrorExporter" });
    const t0 = Date.now();
    const elapsed = () => Date.now() - t0;

    log.info({ websiteId: this.websiteId }, "run() BEGIN");

    this.exporter = new FileExporter(this.websiteId);
    const outputDir = await this.exporter.export();
    log.info({ elapsedMs: elapsed(), outputDir }, "export() completed");

    this.runner = new WebsiteRunner(outputDir);

    log.info({ elapsedMs: elapsed() }, "install() starting");
    await this.runner.install();
    log.info({ elapsedMs: elapsed() }, "install() completed");

    log.info({ websiteId: this.websiteId, elapsedMs: elapsed() }, "start() starting");
    await this.runner.start();
    log.info({ elapsedMs: elapsed(), url: this.runner.getUrl() }, "start() completed");

    // Capture browser errors
    log.info(
      { elapsedMs: elapsed(), url: this.runner.getUrl() },
      "captureBrowserErrors() starting"
    );
    const browserErrors = await this.captureBrowserErrors();
    log.info(
      { elapsedMs: elapsed(), browserErrorCount: browserErrors.length },
      "captureBrowserErrors() completed"
    );

    const viteOverlayErrors = this.errorCapture?.getViteOverlayErrors() || [];

    // Get server output
    const serverErrors = this.runner.getStderr();

    log.info({ browserErrorCount: browserErrors.length }, "Received browser errors");
    log.info({ serverErrorCount: serverErrors.length }, "Received server errors");
    log.info({ viteOverlayCount: viteOverlayErrors.length }, "Received vite overlay errors");

    log.info({ elapsedMs: elapsed() }, "stop() starting");
    await this.stop();
    log.info({ elapsedMs: elapsed() }, "stop() completed");

    log.info({ elapsedMs: elapsed() }, "run() END");
    return createCombinedErrors(browserErrors, serverErrors, viteOverlayErrors);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    return await this.stop();
  }

  private async stop(): Promise<void> {
    // Stop error capture first if it exists
    if (this.errorCapture) {
      await this.errorCapture.stop();
    }

    // Stop the dev server
    if (this.runner) {
      await this.runner.stop();
    }

    // Clean up temporary directory
    if (this.exporter) {
      await this.exporter[Symbol.asyncDispose]();
    }
  }

  private async captureBrowserErrors(): Promise<ConsoleError[]> {
    if (!this.runner) {
      throw new Error("ErrorExporter must be run() before capturing errors");
    }

    this.errorCapture = new BrowserErrorCapture(this.runner.getUrl());

    // Start browser and load the page - this will wait for initial load and capture any errors
    await this.errorCapture.start();

    // The page has loaded and initial errors have been captured
    // No need to wait for more errors - we just want to check if the page loads successfully
    return this.errorCapture.getErrors();
  }
}
