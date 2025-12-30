import { RailsAPIBase, type paths } from "@rails_api_base";
import type { Simplify } from "type-fest";

export type GetUploadsRequest = {
  website_id?: number;
  is_logo?: boolean;
};
export type GetUploadsResponse = NonNullable<
  paths["/api/v1/uploads"]["get"]["responses"][200]["content"]["application/json"]
>;

/** Request body for creating an upload - OpenAPI schema doesn't properly type multipart/form-data */
export interface CreateUploadRequest {
  "upload[file]": File | Blob;
  "upload[is_logo]"?: boolean;
  "upload[website_id]"?: number;
}

export type CreateUploadResponse = NonNullable<
  paths["/api/v1/uploads"]["post"]["responses"][201]["content"]["application/json"]
>;

export class UploadService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

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

  async create(options: CreateUploadRequest): Promise<CreateUploadResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/uploads", {
      // Type assertion needed because OpenAPI schema doesn't properly type multipart/form-data
      body: options as unknown as Record<string, never>,
      bodySerializer: (body) => {
        const formData = new FormData();
        Object.entries(body).forEach(([key, value]) => {
          const isFile = (v: unknown): v is File => v instanceof File;
          const isBlob = (v: unknown): v is Blob => v instanceof Blob;

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
