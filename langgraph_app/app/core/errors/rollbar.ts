import Rollbar from "rollbar";
import { getLoggerContext } from "../logger/context";

const ROLLBAR_ACCESS_TOKEN = process.env.ROLLBAR_ACCESS_TOKEN;
const ENABLED = !!process.env.ROLLBAR_ACCESS_TOKEN;

const logger = new Rollbar({
  accessToken: ROLLBAR_ACCESS_TOKEN,
  captureUncaught: ENABLED,
  captureUnhandledRejections: ENABLED,
  environment: process.env.NODE_ENV || "development",
  enabled: ENABLED,
  verbose: true,
});

type LogContext = Record<string, string | number | boolean | null | undefined>;

function enrichContext(context?: LogContext): LogContext {
  const logCtx = getLoggerContext();
  const enriched: LogContext = {};
  if (logCtx?.requestId) enriched.requestId = logCtx.requestId;
  if (context) Object.assign(enriched, context);
  return enriched;
}

export const rollbar = {
  error: async (error: Error, context?: LogContext) => {
    if (!ENABLED) return;
    await logger.error(error, enrichContext(context));
  },
  warn: async (message: string, context?: LogContext) => {
    if (!ENABLED) return;
    await logger.warning(message, enrichContext(context));
  },
  info: async (message: string, context?: LogContext) => {
    if (!ENABLED) return;
    await logger.info(message, enrichContext(context));
  },
};
