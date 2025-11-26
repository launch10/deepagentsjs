import { createRailsApiClient } from "./client";

export type Options = {
    jwt?: string;
    baseUrl?: string;
}

export class RailsAPIBase {
    client: Awaited<ReturnType<typeof createRailsApiClient>>;
    
    constructor(options: Options) {
        this.client = null as any; // Will be initialized by init()
        this.init(options);
    }
    
    private async init(options: Options) {
        this.client = await createRailsApiClient(options);
    }
}