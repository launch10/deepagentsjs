import { RailsAPIBase, type paths } from "@rails_api";
import { type Simplify } from "type-fest";

export type GetUploadsRequest = Required<NonNullable<paths["/api/v1/uploads"]["get"]["parameters"]["query"]>>;
export type GetUploadsResponse = NonNullable<paths["/api/v1/uploads"]["get"]["responses"][200]["content"]["application/json"]>;
export type CreateUploadRequest = NonNullable<paths["/api/v1/uploads"]["post"]["requestBody"]>["content"]["multipart/form-data"];
export type CreateUploadResponse = NonNullable<paths["/api/v1/uploads"]["post"]["responses"][201]["content"]["application/json"]>;

export class UploadService extends RailsAPIBase {
      constructor(options:
  Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
          super(options)
      }

      async get(params?: GetUploadsRequest): Promise<GetUploadsResponse> {
          const response = await this.client.GET("/api/v1/uploads", {
              params: {
                  query: params
              }
          });

          if (response.response.status !== 200) {
              throw new Error(`Failed to get uploads: ${response.response.status} ${response.response.statusText}`);
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
          const response = await this.client.POST("/api/v1/uploads", {
              body: options,
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
              }
          });

          if (response.response.status !== 201) {
              throw new Error(`Failed to create upload: ${response.response.status} ${response.response.statusText}`);
          }

          if (response.error) {
              throw new Error(`Failed to create upload: ${JSON.stringify(response.error)}`);
          }

          if (!response.data) {
              throw new Error(`Failed to create upload: No data returned`);
          }

          return response.data satisfies CreateUploadResponse;
      }
  }
