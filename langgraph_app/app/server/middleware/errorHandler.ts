import type { ErrorHandler } from "hono";
import { sentry, getLogger } from "@core";
import { env } from "@core";

export const errorHandler: ErrorHandler = (err, c) => {
  getLogger().error({ err }, "Server error");

  const isDev = env.NODE_ENV === "development";
  const isProd = env.NODE_ENV === "production";

  if (isProd) {
    sentry.error(err);
  }

  return c.json(
    {
      error: err.message || "Internal Server Error",
      ...(isDev && { stack: err.stack }),
    },
    500
  );
};
