import createClient from "openapi-fetch";
import type { paths } from "./generated/rails-api";
import { env, isFrontend, isBackend } from "./env";

let jwt: typeof import('jsonwebtoken') | null = null;
let crypto: typeof import('crypto') | null = null;
let backendModulesPromise: Promise<void> | null = null;

async function loadBackendModules() {
  if (!isBackend()) return;

  if (!backendModulesPromise) {
    backendModulesPromise = (async () => {
      const jwtModule = await import('jsonwebtoken');
      jwt = jwtModule.default || jwtModule;
      crypto = await import('crypto');
    })();
  }

  return backendModulesPromise;
}

/** Default timeout for Rails API requests (10 seconds) */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface RailsApiClientOptions {
  jwt?: string;
  baseUrl?: string;
  /**
   * When true, uses internal service-to-service auth (X-Signature + X-Timestamp)
   * instead of user JWT authentication. Use for endpoints that have
   * `skip_before_action :require_api_authentication` and use `verify_internal_api_request`.
   */
  internalServiceCall?: boolean;
  /**
   * Request timeout in milliseconds. Defaults to 10 seconds.
   * Set to 0 to disable timeout.
   */
  timeoutMs?: number;
}

function generateSignature(timestamp: number): string {
  if (!crypto) {
    throw new Error('crypto module not loaded - call loadBackendModules first');
  }
  const secret = env.JWT_SECRET || 'test-secret-key';
  return crypto.createHmac('sha256', secret).update(timestamp.toString()).digest('hex');
}

const testHeaders = (baseHeaders: Record<string, string>) => {
  if (!jwt) {
    throw new Error('jsonwebtoken module not loaded - call loadBackendModules first');
  }
  const jwtSecret = env.JWT_SECRET || 'test-secret-key';
  const testTimestamp = Date.now();
  
  const proof = jwt.sign(
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
    "Accept": "application/json",
  };
}

const addBackendHeaders = (headers: Record<string, string>, jwtToken?: string) => {
  if (!isFrontend()) {
    const timestamp = Math.floor(Date.now() / 1000);
    // Only add Authorization header if we have a JWT (user-authenticated requests)
    if (jwtToken) {
      headers["Authorization"] = `Bearer ${jwtToken}`;
    }
    headers["X-Signature"] = generateSignature(timestamp);
    headers["X-Timestamp"] = timestamp.toString();

    if (env.NODE_ENV === "test") {
      const testHeadersResult = testHeaders(headers);
      return testHeadersResult;
    }
  }
  return headers;
}

const headers = (jwtToken?: string, internalServiceCall?: boolean) => {
  let headers: Record<string, string> = sharedHeaders();

  if (isBackend()) {
    if (internalServiceCall) {
      // Internal service calls: signature only, no JWT
      headers = addBackendHeaders(headers);
    } else if (jwtToken) {
      // User-authenticated calls: JWT + signature
      headers = addBackendHeaders(headers, jwtToken);
    }
  }
  return headers;
}

/**
 * Creates a fetch wrapper with timeout support
 */
function createFetchWithTimeout(timeoutMs: number): typeof fetch {
  if (timeoutMs <= 0) {
    return fetch;
  }

  return async (input, init) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

/**
 * Creates a typed client for the Rails API
 * @param options - Configuration options for the client
 * @returns A typed openapi-fetch client
 */
export async function createRailsApiClient(options: RailsApiClientOptions = {}) {
  // Disable timeout in tests to avoid Polly compatibility issues
  const isTest = env.NODE_ENV === 'test';
  const defaultTimeout = isTest ? 0 : DEFAULT_TIMEOUT_MS;

  const {
    jwt: jwtToken,
    baseUrl = env.RAILS_API_URL || env.VITE_RAILS_API_URL || "http://localhost:3000",
    internalServiceCall = false,
    timeoutMs = defaultTimeout,
  } = options;

  if (isBackend()) {
    await loadBackendModules();
  }

  const client = createClient<paths>({
    baseUrl,
    headers: headers(jwtToken, internalServiceCall),
    // Include credentials (cookies) for frontend requests to enable session auth
    ...(isFrontend() && { credentials: 'include' }),
    // Add timeout support via custom fetch
    fetch: createFetchWithTimeout(timeoutMs),
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
