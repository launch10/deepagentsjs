/**
 * Structured Logger
 *
 * Pino-based structured logging with environment-aware configuration.
 * - Development: pino-pretty for human-readable colorized output
 * - Production: plain JSON to stdout (for log drain ingestion)
 * - Test: silent (no output noise in test runs)
 *
 * Redacts sensitive fields: jwt, authorization, token.
 */
export { rootLogger, type Logger } from "./logger";
export { getLogger, getLoggerContext, loggerStorage, type LoggerContext } from "./context";
