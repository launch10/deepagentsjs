import { createRailsApiClient } from "./client";

export type Options = {
    jwt?: string;
    baseUrl?: string;
}

type Client = Awaited<ReturnType<typeof createRailsApiClient>>;

export class RailsAPIBase {
    private clientPromise: Promise<Client> | null = null;
    private options: Options;

    constructor(options: Options) {
        // Store options but don't create client yet - env may not be loaded
        this.options = options;
    }

    protected async getClient(): Promise<Client> {
        // Lazily create client on first use (after env is loaded)
        if (!this.clientPromise) {
            this.clientPromise = createRailsApiClient(this.options);
        }
        return this.clientPromise;
    }
}