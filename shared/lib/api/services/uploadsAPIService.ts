import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

/**
 * Type definitions for upload operations
 */
export type GetUploadsRequest = {
  website_id?: number;
  uuid?: string;
  filename?: string;
  is_logo?: boolean;
  order?: "recent";
  limit?: number;
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

  /**
   * Find recent images for a website (excludes logos by default)
   * Sorting and limiting is now done at the database level for efficiency.
   */
  async findRecent(options: {
    websiteId: number;
    limit?: number;
    includeLogos?: boolean;
  }): Promise<Upload[]> {
    const { websiteId, limit = 10, includeLogos = false } = options;

    // Use database-level sorting and limiting for efficiency
    const uploads = (await this.get({
      website_id: websiteId,
      is_logo: includeLogos ? undefined : false,
      order: "recent",
      limit,
    })) as Upload[];

    return uploads;
  }

  /**
   * Find logo images for a website
   * Sorting and limiting is now done at the database level for efficiency.
   */
  async findLogos(options: { websiteId: number; limit?: number }): Promise<Upload[]> {
    const { websiteId, limit } = options;

    // Use database-level sorting and limiting for efficiency
    const uploads = (await this.get({
      website_id: websiteId,
      is_logo: true,
      order: "recent",
      limit,
    })) as Upload[];

    return uploads;
  }

  /**
   * Update an upload (set is_logo, associate with website)
   */
  async update(
    uploadId: number,
    options: { isLogo?: boolean; websiteId?: number }
  ): Promise<Upload> {
    const client = await this.getClient();
    const body: Record<string, unknown> = {};
    if (options.isLogo !== undefined) body.is_logo = options.isLogo;
    if (options.websiteId !== undefined) body.website_id = options.websiteId;

    const response = await client.PATCH("/api/v1/uploads/{id}", {
      params: { path: { id: uploadId } },
      body: { upload: body } as any,
    });

    if (response.response.status !== 200) {
      throw new Error(
        `Failed to update upload: ${response.response.status} ${response.response.statusText}`
      );
    }

    if (response.error) {
      throw new Error(`Failed to update upload: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to update upload: No data returned");
    }

    return response.data as Upload;
  }

  /**
   * Find an upload by its UUID
   */
  async findByUuid(uuid: string): Promise<Upload | null> {
    const uploads = (await this.get({ uuid })) as Upload[];
    return uploads[0] || null;
  }

  /**
   * Find an upload by its filename (the CarrierWave file column value).
   * Use this to look up uploads from their URL.
   */
  async findByFilename(filename: string): Promise<Upload | null> {
    const uploads = (await this.get({ filename })) as Upload[];
    return uploads[0] || null;
  }

  /**
   * Extract UUID from an upload URL.
   * Format: https://dev-uploads.launch10.ai/uploads/<uuid>.ext
   */
  static extractUuidFromUrl(url: string): string | null {
    const match = url.match(
      /uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );
    return match?.[1] || null;
  }

  /**
   * Extract filename from an upload URL.
   * Format: https://dev-uploads.launch10.ai/uploads/<uuid>.ext → "<uuid>.ext"
   */
  static extractFilenameFromUrl(url: string): string | null {
    const match = url.match(/uploads\/([0-9a-f-]+\.[a-z]+)/i);
    return match?.[1] || null;
  }

  /**
   * Format uploads as image_url content blocks for LLM consumption
   */
  static formatForModel(images: Upload[]): Array<{ type: "image_url"; image_url: { url: string } }> {
    return images.map((image) => ({
      type: "image_url" as const,
      image_url: { url: image.url },
    }));
  }
}

// Re-export with old name for backwards compatibility during migration
export { UploadsAPIService as UploadService };
