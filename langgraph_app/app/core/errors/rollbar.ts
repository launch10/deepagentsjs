import Rollbar from "rollbar";


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

export const rollbar = {
  error: async (error: Error, context?: LogContext) => {
    if (!ENABLED) return;
    await logger.error(error, context);
  },
  warn: async (message: string, context?: LogContext) => {
    if (!ENABLED) return;
    await logger.warning(message, context)
  },
  info: async (message: string, context?: LogContext) => {
    if (!ENABLED) return;
    await logger.info(message, context);
  },
};
