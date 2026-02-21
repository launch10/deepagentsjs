import * as Sentry from "@sentry/node";
import { getLoggerContext } from "../logger/context";

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENABLED = !!SENTRY_DSN;

if (ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    enabled: ENABLED,
  });
}

type LogContext = Record<string, string | number | boolean | null | undefined>;

function enrichContext(context?: LogContext): LogContext {
  const logCtx = getLoggerContext();
  const enriched: LogContext = {};
  if (logCtx?.requestId) enriched.requestId = logCtx.requestId;
  if (context) Object.assign(enriched, context);
  return enriched;
}

export const sentry = {
  error: async (error: Error, context?: LogContext) => {
    if (!ENABLED) return;
    Sentry.captureException(error, { extra: enrichContext(context) });
  },
  warn: async (message: string, context?: LogContext) => {
    if (!ENABLED) return;
    Sentry.captureMessage(message, { level: "warning", extra: enrichContext(context) });
  },
  info: async (message: string, context?: LogContext) => {
    if (!ENABLED) return;
    Sentry.captureMessage(message, { level: "info", extra: enrichContext(context) });
  },
};
