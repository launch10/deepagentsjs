import { createRailsApiClient, type paths } from "@rails_api";
import { type ThreadIDType } from "@types";

/**
 * Type definitions for brainstorm operations
 */
export type CreateBrainstormRequest = NonNullable<
  paths["/brainstorms"]["post"]["requestBody"]
>["content"]["application/json"];

export type CreateBrainstormResponse = NonNullable<
  paths["/brainstorms"]["post"]["responses"][201]["content"]
>["application/json"];

export type UpdateBrainstormRequest = NonNullable<
  paths["/brainstorms/{id}"]["patch"]["requestBody"]
>["content"]["application/json"];

export type UpdateBrainstormResponse = NonNullable<
  paths["/brainstorms/{id}"]["patch"]["responses"][200]["content"]
>["application/json"];

export type GetBrainstormResponse = NonNullable<
  paths["/brainstorms/{id}"]["get"]["responses"][200]["content"]
>["application/json"];

export interface Brainstorm {
  id: number;
  website_id: number;
  project_id: number;
  name: string;
  thread_id: string;
  account_id: number;
  created_at: string;
  updated_at: string;
};

export interface BrainstormServiceOptions {
  jwtToken?: string;
}

/**
 * Service for interacting with the Rails Brainstorm API
 */
export class BrainstormAPIService {
  private jwtToken?: string;

  constructor(options: BrainstormServiceOptions = {}) {
    this.jwtToken = options.jwtToken;
  }

  /**
   * Creates a new brainstorm
   * @param threadId - The LangGraph thread ID
   * @param name - Optional name for the brainstorm
   * @returns The created brainstorm
   */
  async create(threadId: ThreadIDType, name?: string): Promise<Brainstorm> {
    const client = createRailsApiClient({ jwtToken: this.jwtToken });

    const response = await client.POST("/brainstorms", {
      body: {
        brainstorm: {
          thread_id: threadId,
          ...(name ? { name } : {}),
        },
      },
    });

    if (response.error) {
      throw new Error(`Failed to create brainstorm: ${JSON.stringify(response.error)}`);
    }

    return response.data as Brainstorm;
  }

  /**
   * Retrieves a brainstorm by ID
   * @param id - The brainstorm ID
   * @returns The brainstorm
   */
  async get(id: number): Promise<Brainstorm> {
    const client = createRailsApiClient({ jwtToken: this.jwtToken });

    const response = await client.GET("/brainstorms/{id}", {
      params: {
        path: { id },
      },
    });

    if (response.error) {
      throw new Error(`Failed to get brainstorm: ${JSON.stringify(response.error)}`);
    }

    return response.data as Brainstorm;
  }

  /**
   * Updates a brainstorm
   * @param id - The brainstorm ID
   * @param updates - The fields to update
   * @returns The updated brainstorm
   */
  async update(
    id: number,
    updates: UpdateBrainstormRequest["brainstorm"]
  ): Promise<Brainstorm> {
    const client = createRailsApiClient({ jwtToken: this.jwtToken });

    const response = await client.PATCH("/brainstorms/{id}", {
      params: {
        path: { id },
      },
      body: {
        brainstorm: updates,
      },
    });

    if (response.error) {
      throw new Error(`Failed to update brainstorm: ${JSON.stringify(response.error)}`);
    }

    return response.data as Brainstorm;
  }
}
