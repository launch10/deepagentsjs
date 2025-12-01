import { createRailsApiClient } from "./client";

export type Options = {
    jwt?: string;
    baseUrl?: string;
}

type Client = Awaited<ReturnType<typeof createRailsApiClient>>;

export class RailsAPIBase {
    private clientPromise: Promise<Client>;
    
    constructor(options: Options) {
        this.clientPromise = createRailsApiClient(options);
    }

    protected async getClient(): Promise<Client> {
        return this.clientPromise;
    }
}