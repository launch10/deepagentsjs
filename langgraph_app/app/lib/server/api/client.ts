import createClient from "openapi-fetch";
import type { paths } from "./generated/rails-api";
import { env } from "@core";

export interface RailsApiClientOptions {
  jwtToken?: string;
  baseUrl?: string;
}

/**
 * Creates a typed client for the Rails API
 * @param options - Configuration options for the client
 * @returns A typed openapi-fetch client
 */
export function createRailsApiClient(options: RailsApiClientOptions = {}) {
  const { jwtToken, baseUrl = env.RAILS_API_URL || "http://localhost:3000" } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  if (jwtToken) {
    headers["Authorization"] = `Bearer ${jwtToken}`;
  }

  const client = createClient<paths>({
    baseUrl,
    headers,
  });

  return client;
}

/**
 * Helper type to extract response types from the API
 */
export type ApiResponse<T extends keyof paths, M extends keyof paths[T]> =
  paths[T][M] extends { responses: infer R }
    ? R extends { 201: { content: { "application/json": infer C } } }
      ? C
      : R extends { 200: { content: { "application/json": infer C } } }
      ? C
      : never
    : never;

/**
 * Helper type to extract request body types from the API
 */
export type ApiRequestBody<T extends keyof paths, M extends keyof paths[T]> =
  paths[T][M] extends { requestBody: { content: { "application/json": infer B } } }
    ? B
    : never;
