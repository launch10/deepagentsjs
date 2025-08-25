interface RailsApiRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: any;
    headers?: Record<string, string>;
    jwt?: string;
}

interface RailsApiResponse<T = any> {
    data?: T;
    error?: {
        message: string;
        status?: number;
        details?: any;
    };
    success: boolean;
}

export class RailsApiService {
    private apiUrl: string;

    constructor() {
        const apiUrl = process.env.RAILS_API_URL;
        if (!apiUrl) {
            throw new Error('RAILS_API_URL is not defined in environment variables');
        }
        this.apiUrl = apiUrl;
    }

    async request<T = any>(
        endpoint: string, 
        options: RailsApiRequestOptions = {}
    ): Promise<RailsApiResponse<T>> {
        const { method = 'GET', body, headers = {}, jwt } = options;

        const requestOptions: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...headers,
            },
        };

        if (jwt) {
            requestOptions.headers = {
                ...requestOptions.headers,
                'Authorization': `Bearer ${jwt}`,
            };
        }

        if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
            requestOptions.body = JSON.stringify(body);
        }

        try {
            const url = `${this.apiUrl}/${endpoint}`;
            console.log(`Making ${method} request to: ${url}`);
            
            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: {
                        message: errorData.message || `Request failed with status ${response.status}`,
                        status: response.status,
                        details: errorData,
                    },
                };
            }

            const data = await response.json();
            return {
                success: true,
                data,
            };
        } catch (error) {
            console.error(`Rails API request failed for ${endpoint}:`, error);
            debugger;
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Unknown error occurred',
                    details: error,
                },
            };
        }
    }

    async get<T = any>(endpoint: string, jwt?: string): Promise<RailsApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'GET', jwt });
    }

    async post<T = any>(endpoint: string, body: any, jwt?: string): Promise<RailsApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'POST', body, jwt });
    }

    async put<T = any>(endpoint: string, body: any, jwt?: string): Promise<RailsApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'PUT', body, jwt });
    }

    async delete<T = any>(endpoint: string, jwt?: string): Promise<RailsApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'DELETE', jwt });
    }

    async patch<T = any>(endpoint: string, body: any, jwt?: string): Promise<RailsApiResponse<T>> {
        return this.request<T>(endpoint, { method: 'PATCH', body, jwt });
    }
}

export const railsApiService = new RailsApiService();