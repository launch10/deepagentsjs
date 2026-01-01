import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

/**
 * Type definitions for upload operations
 */
export type GetUploadsRequest = {
  website_id?: number;
  is_logo?: boolean;
};

export type GetUploadsResponse = NonNullable<
  paths["/api/v1/uploads"]["get"]["responses"][200]["content"]["application/json"]
>;

export type CreateUploadResponse = NonNullable<
  paths["/api/v1/uploads"]["post"]["responses"][201]["content"]["application/json"]
>;

/** Request body for creating an upload - uses camelCase, converted to Rails format internally */
export interface CreateUploadRequest {
  file: File | Blob;
  isLogo?: boolean;
  websiteId?: number;
}

/** Upload type matching the GET /api/v1/uploads response */
export interface Upload {
  id: number;
  uuid: string;
  url: string;
  thumb_url?: string | null;
  medium_url?: string | null;
  media_type: "image" | "video" | "document";
  is_logo: boolean;
  filename: string;
  created_at: string;
  updated_at: string;
}

/**
 * Service for interacting with the Rails Uploads API
 * Can be used from both frontend and backend (langgraph)
 */
export class UploadsAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  /**
   * Get uploads for the authenticated user
   * @param params - Optional query parameters (website_id, is_logo filters)
   * @returns List of uploads
   */
  async get(params?: GetUploadsRequest): Promise<GetUploadsResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/uploads", {
      params: {
        query: params,
      },
    });

    if (response.response.status !== 200) {
      throw new Error(
        `Failed to get uploads: ${response.response.status} ${response.response.statusText}`
      );
    }

    if (response.error) {
      throw new Error(`Failed to get uploads: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to get uploads: No data returned`);
    }

    return response.data satisfies GetUploadsResponse;
  }

  /**
   * Create a new upload
   * @param options - The upload options (file, isLogo, websiteId)
   * @returns The created upload
   */
  async create(options: CreateUploadRequest): Promise<CreateUploadResponse> {
    const client = await this.getClient();

    // Build the request body with Rails nested params format
    const body: Record<string, unknown> = {
      "upload[file]": options.file,
    };

    if (options.isLogo !== undefined) {
      body["upload[is_logo]"] = options.isLogo;
    }

    if (options.websiteId !== undefined) {
      body["upload[website_id]"] = options.websiteId;
    }

    const response = await client.POST("/api/v1/uploads", {
      // Type assertion needed because OpenAPI schema doesn't properly type multipart/form-data
      body: body as unknown as Record<string, never>,
      bodySerializer: (body) => {
        const formData = new FormData();
        Object.entries(body).forEach(([key, value]) => {
          const isFile = (v: unknown): v is File =>
            typeof File !== "undefined" && v instanceof File;
          const isBlob = (v: unknown): v is Blob =>
            typeof Blob !== "undefined" && v instanceof Blob;

          if (isFile(value) || isBlob(value)) {
            formData.append(key, value);
          } else if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        });
        return formData;
      },
    });

    if (response.response.status !== 201) {
      throw new Error(
        `Failed to create upload: ${response.response.status} ${response.response.statusText}`
      );
    }

    if (response.error) {
      throw new Error(`Failed to create upload: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to create upload: No data returned`);
    }

    return response.data satisfies CreateUploadResponse;
  }

  /**
   * Delete an upload
   * @param uploadId - The upload ID to delete
   */
  async delete(uploadId: number): Promise<void> {
    const client = await this.getClient();
    const response = await client.DELETE("/api/v1/uploads/{id}", {
      params: {
        path: { id: uploadId },
      },
    });

    if (response.response.status !== 204) {
      throw new Error(
        `Failed to delete upload: ${response.response.status} ${response.response.statusText}`
      );
    }
  }
}

// Re-export with old name for backwards compatibility during migration
export { UploadsAPIService as UploadService };
