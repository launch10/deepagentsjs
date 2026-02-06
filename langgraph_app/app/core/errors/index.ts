import { rollbar } from "./rollbar";
import { ReporterRegistry } from "./reporterRegistry";
import { env } from "@app";
import { getLogger } from "../logger/context";

const devLogger = (e: unknown) => {
  if (env.NODE_ENV === "test" || env.NODE_ENV === "development") {
    getLogger({ component: "ErrorReporter" }).error({ err: e }, "Unhandled error");
  }
};

export const ErrorReporters = new ReporterRegistry().addReporter("dev", devLogger);

export { rollbar };
