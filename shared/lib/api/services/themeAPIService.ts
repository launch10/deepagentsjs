import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

export type GetThemeRequest = NonNullable<
  paths["/api/v1/themes/{id}"]["get"]["parameters"]["path"]
>;

// Single theme response (from /api/v1/themes/{id})
export type GetThemeResponse = NonNullable<
  paths["/api/v1/themes/{id}"]["get"]["responses"][200]["content"]["application/json"]
>;

export type GetThemesRequest = NonNullable<
  paths["/api/v1/themes"]["get"]["parameters"]["path"]
>;

// Multiple themes response (from /api/v1/themes)
export type GetThemesResponse = NonNullable<
  paths["/api/v1/themes"]["get"]["responses"][200]["content"]["application/json"]
>;

export type CreateThemeRequest = NonNullable<
  paths["/api/v1/themes"]["post"]["requestBody"]
>["content"]["application/json"];
export type CreateThemeResponse = NonNullable<
  paths["/api/v1/themes"]["post"]["responses"][200]["content"]["application/json"]
>;

/**
 * Service for interacting with the Rails Themes API
 */
export class ThemeAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  async get(id: number): Promise<GetThemeResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/themes/{id}", {
      params: { path: { id } },
    });

    if (response.error) {
      throw new Error(`Failed to get theme: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to get theme: No data returned");
    }

    return response.data satisfies GetThemeResponse;
  }

  async list(): Promise<GetThemesResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/themes");

    if (response.error) {
      throw new Error(`Failed to list themes: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to list themes: No data returned");
    }

    return response.data satisfies GetThemesResponse;
  }

  async create(options: CreateThemeRequest): Promise<CreateThemeResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/themes", { body: options });

    if (response.error) {
      throw new Error(`Failed to create theme: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to create theme: No data returned");
    }

    return response.data satisfies CreateThemeResponse;
  }
}

// Re-export with old name for backwards compatibility during migration
export { ThemeAPIService as ThemeService };
