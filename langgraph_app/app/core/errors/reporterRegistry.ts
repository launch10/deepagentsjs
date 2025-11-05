type ReportingFn = (error: Error) => void;

const preconfiguredReporters: Record<string, ReportingFn> = {
    console: (error) => console.error(error),
}

export class ReporterRegistry<TRegistered extends string = never> {
    reporters: Record<TRegistered, ReportingFn> = {} as Record<TRegistered, ReportingFn>;

    addReporter<TName extends string>(name: TName, reporter?: ReportingFn) {
        if (!reporter) {
            if (!preconfiguredReporters[name]) {
                throw new Error(`Reporter ${name} not found`);
            }
            reporter = preconfiguredReporters[name];
        }
        (this.reporters as any)[name] = reporter;
        return this as unknown as ReporterRegistry<TRegistered | TName>;
    }

    list(): TRegistered[] {
        return Object.keys(this.reporters) as TRegistered[];
    }

    report(name: TRegistered, error: Error) {
        const reporter = this.reporters[name];
        if (!reporter) {
            throw new Error(`Reporter ${name} not found`);
        }
        reporter(error);
    }

    reportAll(error: Error) {
        Object.keys(this.reporters).forEach((name) => {
            this.report(name as TRegistered, error);
        });
    }
}
