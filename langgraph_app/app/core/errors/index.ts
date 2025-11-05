import { ReporterRegistry } from "./reporterRegistry";
import { rollbar } from "./rollbar";
import { env } from "@app";

const localLogger = (e: unknown) => {
    if (env.NODE_ENV === "test" || env.NODE_ENV === "development") {
        console.log(e);
    }
}

export const ErrorReporters = new ReporterRegistry()
    .addReporter("rollbar", rollbar.error)
    .addReporter("local", localLogger);