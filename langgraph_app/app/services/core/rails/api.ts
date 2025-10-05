import { env } from "@app";
import jwt from 'jsonwebtoken';
import { isObject } from "@types";
interface RailsApiRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: any;
    headers?: Record<string, string>;
    jwt?: string;
}

export type APIError = string;
export type SuccessStatusCode = 200 | 201 | 202 | 203 | 204 | 205 | 206;
export type ClientErrorStatusCode = 400 | 401 | 403 | 404 | 422 | 429;
export type ServerErrorStatusCode = 500 | 502 | 503 | 504;
export type RedirectStatusCode = 301 | 302 | 303 | 307 | 308;
export type ErrorStatusCode = ClientErrorStatusCode | ServerErrorStatusCode;
export type GenericAPIResponse = Record<string, any>;

export const isSuccessResponse = (response: RailsApiResponse): response is SuccessResponse => {
    return response.success && response.status >= 200 && response.status < 300;
}

export const isRedirectResponse = (response: RailsApiResponse): response is RedirectResponse => {
    return response.success && response.status >= 300 && response.status < 400;
}

export const isErrorResponse = (response: RailsApiResponse): response is ErrorResponse => {
    return response.success === false && response.status >= 400 && response.status < 600;
}

const isValidAPIResponse = (response: unknown): response is RailsApiResponse => {
    if (!isObject(response) || !('success' in response) || typeof response.success !== 'boolean' || !('status' in response) || typeof response.status !== 'number') {
        return false;
    }

    if (response.success === true && 'data' in response) {
        return true; // SuccessResponse
    }
    if (response.success === false && 'errors' in response && Array.isArray(response.errors)) {
        return true; // ErrorResponse
    }
    if (response.success === false && 'location' in response && typeof response.location === 'string') {
        return true; // RedirectResponse
    }
    return false;
}

export interface SuccessResponse<T = any> {
    data: T;
    status: SuccessStatusCode;
    success: true;
}
export interface ErrorResponse {
    errors: APIError[];
    status: ErrorStatusCode;
    success: false;
}
export interface RedirectResponse {
    location: string;
    status: RedirectStatusCode;
    success: false;
}

export type RailsApiResponse<T = any> = SuccessResponse<T> | ErrorResponse | RedirectResponse;

// Type for field mappers - can be string (direct mapping) or transform functions
export type FieldMapper<TInternal extends GenericAPIResponse, TExternal extends GenericAPIResponse> = {
    [K in keyof TInternal]?: string | {
        to: (value: TInternal[K]) => any;
        from: (value: any) => TInternal[K];
    };
};
export abstract class RailsApiService<TInternal extends GenericAPIResponse, TExternal extends GenericAPIResponse> {
    protected apiUrl: string;
    
    // Subclasses should override this to provide field mappings
    protected abstract getFieldMapper(): FieldMapper<TInternal, TExternal>;
    protected abstract resourceName(): string;

    static shouldWrap(): boolean {
        return true
    }

    shouldWrap(): boolean {
        return (this.constructor as typeof RailsApiService).shouldWrap()
    }

    constructor() {
        const apiUrl = process.env.RAILS_API_URL;
        if (!apiUrl) {
            throw new Error('RAILS_API_URL is not defined in environment variables');
        }
        this.apiUrl = apiUrl;
    }

    /**
     * Map from internal representation to external (Rails API) representation
     */
    protected mapToExternal(internal: Partial<TInternal>, endpoint?: string): Partial<TExternal | { [key: string]: TExternal }> {
        const mapper = this.getFieldMapper();
        if (Object.keys(mapper).length === 0) { return internal as unknown as Partial<TExternal>; }
        const external: any = {};

        for (const [internalKey, value] of Object.entries(internal)) {
            const mapping = mapper[internalKey as keyof TInternal];
            
            if (!mapping) {
                // No mapping defined, skip this field
                continue;
            }

            if (typeof mapping === 'string') {
                // Simple field rename
                external[mapping] = value;
            } else if (typeof mapping === 'object' && mapping.to) {
                // Custom transformation
                const externalKey = Object.entries(mapper).find(
                    ([_, v]) => v === mapping
                )?.[0];
                if (externalKey) {
                    external[externalKey] = mapping.to(value as TInternal[keyof TInternal]);
                }
            }
        }

        // Extract resource name from endpoint (e.g., "websites" -> "website")
        if (this.shouldWrap()) {
            const resourceName = this.resourceName();
            return { [resourceName]: external };
        }

        return external;
    }

    /**
     * Map from external (Rails API) representation to internal representation
     */
    protected mapFromExternal(external: Partial<TExternal | { [key: string]: TExternal }>): Partial<TInternal> {
        const mapper = this.getFieldMapper();
        if (Object.keys(mapper).length === 0) { return external as unknown as Partial<TInternal>; }
        const internal: any = {};

        // Create reverse mapping
        const reverseMap: Record<string, string | { from: (value: any) => any }> = {};
        for (const [internalKey, mapping] of Object.entries(mapper)) {
            if (typeof mapping === 'string') {
                reverseMap[mapping] = internalKey;
            } else if (mapping && typeof mapping === 'object' && 'from' in mapping) {
                // For custom mappings, we need to handle them specially
                reverseMap[internalKey] = mapping as { from: (value: any) => any };
            }
        }

        for (const [externalKey, value] of Object.entries(external)) {
            const mapping = reverseMap[externalKey];
            
            if (!mapping) {
                // No mapping defined, use the key as-is
                internal[externalKey] = value;
            } else if (typeof mapping === 'string') {
                // Simple field rename
                internal[mapping] = value;
            } else if (mapping && typeof mapping === 'object' && 'from' in mapping) {
                // Custom transformation
                const internalKey = Object.entries(mapper).find(
                    ([_, v]) => v === mapping
                )?.[0];
                if (internalKey) {
                    internal[internalKey] = mapping.from(value);
                }
            }
        }

        return internal;
    }

    async request(
        endpoint: string, 
        options: RailsApiRequestOptions = {}
    ): Promise<RailsApiResponse<TExternal>> {
        const { method = 'GET', body, headers = {} } = options;
        let authToken = options.jwt || (env.NODE_ENV === 'test' ? 'test-jwt' : undefined);

        const requestOptions: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...headers,
            },
        };

        if (authToken) {
            requestOptions.headers = {
                ...requestOptions.headers,
                'Authorization': `Bearer ${authToken}`,
            };
        }

        // Add test mode headers for authentication bypass in test environment
        if (env.NODE_ENV === 'test') {
            const jwtSecret = env.JWT_SECRET || 'test-secret-key';
            const timestamp = Date.now();
            
            const proof = jwt.sign(
                { timestamp, mode: 'test' },
                jwtSecret,
                { expiresIn: '1m', algorithm: 'HS256' }
            );

            requestOptions.headers = {
                ...requestOptions.headers,
                'X-Test-Mode': 'true',
                'X-Test-Proof': proof,
                'Authorization': 'Bearer test-jwt'
            };
        }

        if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
            requestOptions.body = JSON.stringify(body);
        }

        try {
            const url = `${this.apiUrl}/${endpoint}`;
            const response = await fetch(url, requestOptions);
            const status = response.status as SuccessStatusCode | ErrorStatusCode | RedirectStatusCode;
            
            // Handle redirects (3xx)
            if (status >= 300 && status < 400) {
                const location = response.headers.get('Location') || '';
                return {
                    success: false,
                    location,
                    status: status as RedirectStatusCode,
                } as RedirectResponse;
            }

            // Try to parse JSON response body
            let responseData: unknown;
            try {
                responseData = await response.json();
            } catch {
                responseData = {};
            }

            // Handle success responses (2xx)
            if (response.ok) {
                return {
                    success: true,
                    data: responseData as TExternal,
                    status: status as SuccessStatusCode,
                } as SuccessResponse<TExternal>;
            }

            // Handle error responses (4xx, 5xx)
            // Rails typically returns errors in these formats:
            // { "errors": { "field": ["error message"] } }
            // { "error": "error message" }
            // { "errors": ["error1", "error2"] }
            const errors: string[] = [];
            
            if (isObject(responseData)) {
                if ('errors' in responseData) {
                    if (Array.isArray(responseData.errors)) {
                        errors.push(...responseData.errors);
                    } else if (isObject(responseData.errors)) {
                        // Handle Rails validation errors: { field: ["message"] }
                        for (const [field, messages] of Object.entries(responseData.errors)) {
                            if (Array.isArray(messages)) {
                                errors.push(...messages.map(msg => `${field}: ${msg}`));
                            } else {
                                errors.push(`${field}: ${messages}`);
                            }
                        }
                    } else {
                        errors.push(String(responseData.errors));
                    }
                } else if ('error' in responseData && typeof responseData.error === 'string') {
                    errors.push(responseData.error);
                }
            }

            if (errors.length === 0) {
                errors.push(response.statusText || 'Request failed');
            }

            return {
                success: false,
                errors,
                status: status as ErrorStatusCode,
            } as ErrorResponse;
            
        } catch (error) {
            console.error(`Rails API request failed for ${endpoint}:`, error);
            return {
                success: false,
                errors: [
                    error instanceof Error ? error.message : 'Unknown error occurred',
                ],
                status: 500,
            } as ErrorResponse;
        }
    }

    async get(endpoint: string, jwt?: string): Promise<SuccessResponse<TInternal> | ErrorResponse> {
        const response: RailsApiResponse<TExternal> = await this.request(
            endpoint, { method: 'GET', jwt }
        );

        return this.manageResponse(response);
    }

    async post(endpoint: string, body: Partial<TInternal>, jwt?: string): Promise<SuccessResponse<TInternal> | ErrorResponse> {
        const externalBody = this.mapToExternal(body, endpoint);
        const response: RailsApiResponse<TExternal> = await this.request(endpoint, { method: 'POST', body: externalBody, jwt });

        return this.manageResponse(response);
    }

    async put(endpoint: string, body: Partial<TInternal>, jwt?: string): Promise<SuccessResponse<TInternal> | ErrorResponse> {
        const externalBody = this.mapToExternal(body);
        const response: RailsApiResponse<TExternal> = await this.request(endpoint, { method: 'PUT', body: externalBody, jwt });
        
        return this.manageResponse(response);
    }

    async delete(endpoint: string, jwt?: string): Promise<SuccessResponse<TInternal> | ErrorResponse> {
        const response: RailsApiResponse<TExternal> = await this.request(endpoint, { method: 'DELETE', jwt });
        
        return this.manageResponse(response);
    }

    async patch(endpoint: string, body: Partial<TInternal>, jwt?: string): Promise<SuccessResponse<TInternal> | ErrorResponse> {
        const externalBody = this.mapToExternal(body);
        const response: RailsApiResponse<TExternal> = await this.request(endpoint, { method: 'PATCH', body: externalBody, jwt });
        
        return this.manageResponse(response);
    }

    async index(endpoint: string, key: string, jwt?: string): Promise<SuccessResponse<TInternal[]> | ErrorResponse> {
        const response: RailsApiResponse<TExternal> = await this.request(endpoint, { method: 'GET', jwt });
        
        if (isRedirectResponse(response)) {
            throw new Error(`Redirect response: ${response.location}`);
        }
        
        if (isSuccessResponse(response)) {
            const data = response.data;
            
            // Type guard: ensure data is an object
            if (!isObject(data)) {
                throw new Error(`Expected response data to be an object, got ${typeof data}`);
            }
            
            // Type guard: ensure the key exists in the object
            if (!(key in data)) {
                throw new Error(`Expected response to contain key '${key}'`);
            }
            
            const arrayData = data[key];
            
            // Type guard: ensure the value at key is an array
            if (!Array.isArray(arrayData)) {
                throw new Error(`Expected '${key}' to be an array, got ${typeof arrayData}`);
            }

            // After all type guards, we can safely map
            const mappedData = arrayData.map(item => {
                const mapped = this.mapFromExternal(item);
                return mapped as TInternal;
            });

            return {
                ...response,
                data: mappedData
            } as SuccessResponse<TInternal[]>;
        } else if (isErrorResponse(response)) {
            return response;
        }

        throw new Error(`Unknown response format: ${JSON.stringify(response)}`);
    }

    async manageResponse(response: RailsApiResponse<TExternal>): Promise<SuccessResponse<TInternal> | ErrorResponse> {
        if (isRedirectResponse(response)) {
            throw new Error(`Redirect response: ${response.location}`);
        }
        
        if (isSuccessResponse(response)) {
            return {
                ...response,
                data: this.mapFromExternal(response.data) as TInternal
            } as SuccessResponse<TInternal>;
        } else if (isErrorResponse(response)) {
            return response;
        }

        throw new Error(`Unknown response format: ${JSON.stringify(response)}`);
    }
}