import { ReporterRegistry } from "./reporterRegistry";
import { rollbar } from "./rollbar";

export const ErrorReporters = new ReporterRegistry()
    .addReporter("rollbar", rollbar.error);