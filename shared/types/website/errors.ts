export interface ConsoleError {
  type: 'error' | 'warning' | 'vite-overlay';
  message: string;
  location?: string;
  stack?: string;
  timestamp: Date;
  /** File path for Vite overlay errors */
  file?: string;
  /** Code frame showing the error location */
  frame?: string;
}

export interface HasErrorsOptions {
  /** Exclude warnings from error count */
  excludeWarnings?: boolean;
}

/**
 * Combined errors from all sources (browser console, server output, Vite overlay)
 */
export interface CombinedErrors {
  /** Browser console errors and warnings */
  browser: ConsoleError[];
  /** Server stderr lines (build errors, import resolution failures) */
  server: string[];
  /** Vite error overlay errors */
  viteOverlay: ConsoleError[];
  /** Check if any errors exist */
  hasErrors(options?: HasErrorsOptions): boolean;
  /** Get a formatted report for AI consumption */
  getFormattedReport(): string;
}
