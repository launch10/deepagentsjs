import { createRailsApiClient } from "./client";

export type Options = {
    jwt?: string;
    baseUrl?: string;
}

export class RailsAPIBase {
    client: ReturnType<typeof createRailsApiClient>;
    
    constructor(options: Options) {
        this.client = createRailsApiClient(options);
    }
}