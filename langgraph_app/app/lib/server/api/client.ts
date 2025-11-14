import createClient from "openapi-fetch";
import type { paths } from "./generated/rails-api";
import * as jwtLib from 'jsonwebtoken';
import { env } from "@core";
export interface RailsApiClientOptions {
  jwt: string;
  baseUrl?: string;
}

const headers = (jwt: string) => {
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${jwt}`,
  };

  if (env.NODE_ENV !== "test") {
    return headers;
  }
  const jwtSecret = env.JWT_SECRET || 'test-secret-key';
  const timestamp = Date.now();
  
  const proof = jwtLib.sign(
      { timestamp, mode: 'test' },
      jwtSecret,
      { expiresIn: '1m', algorithm: 'HS256' }
  );
  return {
    ...headers,
    "X-Test-Mode": "true",
    "X-Test-Proof": proof,
  }
}

/**
 * Creates a typed client for the Rails API
 * @param options - Configuration options for the client
 * @returns A typed openapi-fetch client
 */
export function createRailsApiClient(options: RailsApiClientOptions) {
  const { jwt, baseUrl = env.RAILS_API_URL || "http://localhost:3000" } = options;

  console.log("Creating Rails API client with JWT:", jwt);
  console.log("Creating Rails API client with baseUrl:", baseUrl);

  if (!jwt) {
    throw new Error("JWT is required for API authentication");
  }

  const client = createClient<paths>({
    baseUrl,
    headers: headers(jwt),
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
