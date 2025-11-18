import { ReporterRegistry } from "./reporterRegistry";
import { rollbar } from "./rollbar";
import { env } from "@app";

const devLogger = (e: unknown) => {
    if (env.NODE_ENV === "test" || env.NODE_ENV === "development") {
        console.log(`ERROR!!!`)
        console.log(e);
    }
}

export const ErrorReporters = new ReporterRegistry()
    .addReporter("rollbar", rollbar.error)
    .addReporter("dev", devLogger);