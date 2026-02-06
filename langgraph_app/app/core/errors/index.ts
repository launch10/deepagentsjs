import { rollbar } from "./rollbar";
import { ReporterRegistry } from "./reporterRegistry";
import { env } from "@app";

const devLogger = (e: unknown) => {
  if (env.NODE_ENV === "test" || env.NODE_ENV === "development") {
    console.error("[Launch10 Error]", e);
  }
};

export const ErrorReporters = new ReporterRegistry().addReporter("dev", devLogger);

export { rollbar };
