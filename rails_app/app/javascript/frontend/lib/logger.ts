type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

const LEVELS: Record<LogLevel, number> = {
  error: 0, warn: 1, info: 2, debug: 3, trace: 4,
};

function getLevel(): LogLevel {
  // Runtime override (set in browser console: window.__LOG_LEVEL__ = "debug")
  if (typeof window !== "undefined" && (window as any).__LOG_LEVEL__) {
    return (window as any).__LOG_LEVEL__ as LogLevel;
  }
  // Build-time env var
  return (import.meta.env.VITE_LOG_LEVEL as LogLevel) ||
    (import.meta.env.DEV ? "info" : "error");
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] <= LEVELS[getLevel()];
}

export const logger = {
  error: (tag: string, ...args: unknown[]) =>
    shouldLog("error") && console.error(`[${tag}]`, ...args),
  warn: (tag: string, ...args: unknown[]) =>
    shouldLog("warn") && console.warn(`[${tag}]`, ...args),
  info: (tag: string, ...args: unknown[]) =>
    shouldLog("info") && console.info(`[${tag}]`, ...args),
  debug: (tag: string, ...args: unknown[]) =>
    shouldLog("debug") && console.debug(`[${tag}]`, ...args),
  trace: (tag: string, ...args: unknown[]) =>
    shouldLog("trace") && console.debug(`[TRACE:${tag}]`, ...args),
};
