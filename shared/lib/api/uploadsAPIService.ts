import { RailsAPIBase, type paths } from "./index";
import type { Simplify } from "type-fest";

/**
 * Type definitions for upload operations
 */
export type GetUploadsRequest = NonNullable<
  paths["/api/v1/uploads"]["get"]["parameters"]["query"]
>;

export type GetUploadsResponse = NonNullable<
  paths["/api/v1/uploads"]["get"]["responses"][200]["content"]["application/json"]
>;

export type CreateUploadResponse = NonNullable<
  paths["/api/v1/uploads"]["post"]["responses"][201]["content"]["application/json"]
>;

/** Request body for creating an upload - OpenAPI schema doesn't properly type multipart/form-data */
export interface CreateUploadRequest {
  file: File | Blob;
  isLogo?: boolean;
  websiteId?: number;
}

export interface Upload {
  id: number;
  url: string;
  thumb_url: string | null;
  medium_url: string | null;
  media_type: "image" | "video" | "document";
  filename: string;
  content_type: string;
  file_size: number;
  is_logo: boolean;
  website_id: number | null;
  account_id: number;
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
   * @param params - Optional query parameters (website_id filter)
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
   * Get uploads by their IDs
   * @param ids - Array of upload IDs to fetch
   * @returns List of uploads matching the IDs
   */
  async getByIds(ids: number[]): Promise<Upload[]> {
    if (ids.length === 0) {
      return [];
    }

    const client = await this.getClient();
    // Pass ids as array - openapi-fetch serializes arrays as ids[]=1&ids[]=2
    const response = await client.GET("/api/v1/uploads", {
      params: {
        query: { ids: ids } as unknown as GetUploadsRequest,
      },
    });

    if (response.response.status !== 200) {
      throw new Error(
        `Failed to get uploads by IDs: ${response.response.status} ${response.response.statusText}`
      );
    }

    if (response.error) {
      throw new Error(`Failed to get uploads by IDs: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      return [];
    }

    return response.data as Upload[];
  }

  /**
   * Create a new upload
   * @param options - The upload options (file, isLogo, websiteId)
   * @returns The created upload
   */
  async create(options: CreateUploadRequest): Promise<Upload> {
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
          const isFile = (v: unknown): v is File => typeof File !== "undefined" && v instanceof File;
          const isBlob = (v: unknown): v is Blob => typeof Blob !== "undefined" && v instanceof Blob;

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

    return response.data as Upload;
  }

  /**
   * Create uploads from file paths (for testing in Node.js environment)
   * @param filePaths - Array of file paths to upload
   * @param websiteId - Optional website ID to associate uploads with
   * @returns Array of created uploads
   */
  async createFromPaths(filePaths: string[], websiteId?: number): Promise<Upload[]> {
    // Dynamic import for Node.js fs and path modules
    const fs = await import("fs");
    const path = await import("path");

    const uploads: Upload[] = [];

    for (const filePath of filePaths) {
      const filename = path.basename(filePath);
      const buffer = fs.readFileSync(filePath);
      const mimeType = this.getMimeType(filename);

      // Create a Blob from the buffer
      const blob = new Blob([buffer], { type: mimeType });

      const upload = await this.create({
        file: blob,
        websiteId,
      });

      uploads.push(upload);
    }

    return uploads;
  }

  /**
   * Get MIME type from filename extension
   */
  private getMimeType(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      mp4: "video/mp4",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }
}
