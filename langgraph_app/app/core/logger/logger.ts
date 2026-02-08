/**
 * Root Pino Logger
 *
 * Singleton logger instance used across the application.
 * Child loggers are created via getLogger() in context.ts.
 */
import pino from "pino";

export type Logger = pino.Logger;

const NODE_ENV = process.env.NODE_ENV || "development";

function createLogger(): pino.Logger {
  const isTest = NODE_ENV === "test" || process.env.VITEST === "true";
  const isDev = NODE_ENV === "development";

  return pino({
    level: process.env.LOG_LEVEL || (isTest ? "silent" : isDev ? "debug" : "info"),
    redact: {
      paths: ["jwt", "authorization", "token", "*.jwt", "*.authorization", "*.token"],
      censor: "[REDACTED]",
    },
    base: { service: "langgraph", env: NODE_ENV },
    ...(isDev && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname,service,env",
        },
      },
    }),
  });
}

export const rootLogger = createLogger();
