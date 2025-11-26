import createClient from "openapi-fetch";
import type { paths } from "./generated/rails-api";
import { env, isFrontend, isBackend } from "./env";

// Backend-only imports - lazy loaded to avoid bundling in frontend
let jwtLib: typeof import('jsonwebtoken') | undefined;
let crypto: typeof import('crypto') | undefined;

async function loadBackendDeps() {
  if (!jwtLib && isBackend()) {
    try {
      jwtLib = await import('jsonwebtoken');
      crypto = await import('crypto');
    } catch (e) {
      // Dependencies not available (frontend build)
    }
  }
}

export interface RailsApiClientOptions {
  jwt?: string;
  baseUrl?: string;
}

function generateSignature(timestamp: number): string {
  if (!crypto) return '';
  const secret = env.JWT_SECRET || 'test-secret-key';
  return crypto.createHmac('sha256', secret).update(timestamp.toString()).digest('hex');
}

const testHeaders = (baseHeaders: Record<string, string>) => {
  if (!jwtLib) return baseHeaders;
  
  const jwtSecret = env.JWT_SECRET || 'test-secret-key';
  const testTimestamp = Date.now();
  
  const proof = jwtLib.sign(
      { timestamp: testTimestamp, mode: 'test' },
      jwtSecret,
      { expiresIn: '1m', algorithm: 'HS256' }
  );
  return {
    ...baseHeaders,
    "X-Test-Mode": "true",
    "X-Test-Proof": proof,
  }
}

const sharedHeaders = (): Record<string, string> => {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

const addBackendHeaders = (headers: Record<string, string>, jwt: string) => {
  if (!isFrontend()) {
    const timestamp = Math.floor(Date.now() / 1000);
    headers["Authorization"] = `Bearer ${jwt}`;
    headers["X-Signature"] = generateSignature(timestamp);
    headers["X-Timestamp"] = timestamp.toString();

    if (env.NODE_ENV === "test") {
      return testHeaders(headers);
    }
  }
  return headers;
}

const headers = (jwt?: string) => {
  let headers: Record<string, string> = sharedHeaders();

  if (jwt && isBackend()) {
    headers = addBackendHeaders(headers, jwt);
  }
  return headers;
}

/**
 * Creates a typed client for the Rails API
 * @param options - Configuration options for the client
 * @returns A typed openapi-fetch client
 */
export async function createRailsApiClient(options: RailsApiClientOptions) {
  await loadBackendDeps();
  
  const { jwt, baseUrl = env.RAILS_API_URL || env.VITE_RAILS_API_URL || "http://localhost:3000" } = options;

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
