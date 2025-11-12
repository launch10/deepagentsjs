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
  paths["/brainstorms/{thread_id}"]["patch"]["requestBody"]
>["content"]["application/json"];

export type UpdateBrainstormResponse = NonNullable<
  paths["/brainstorms/{thread_id}"]["patch"]["responses"][200]["content"]
>["application/json"];

export type GetBrainstormResponse = NonNullable<
  paths["/brainstorms/{thread_id}"]["get"]["responses"][200]["content"]
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
  jwt: string;
}

/**
 * Service for interacting with the Rails Brainstorm API
 */
export class BrainstormAPIService {
  private jwt: string;

  constructor(options: BrainstormServiceOptions) {
    this.jwt = options.jwt;
  }

  /**
   * Creates a new brainstorm
   * @param threadId - The LangGraph thread ID
   * @param name - Optional name for the brainstorm
   * @returns The created brainstorm
   */
  async create(threadId: ThreadIDType, name?: string): Promise<Brainstorm> {
    const client = createRailsApiClient({ jwt: this.jwt });

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

    if (!response.data) {
      throw new Error(`Failed to create brainstorm: ${JSON.stringify(response.error)}`);
    }

    return response.data satisfies Brainstorm;
  }

  /**
   * Retrieves a brainstorm by thread ID
   * @param threadId - The LangGraph thread ID
   * @returns The brainstorm
   */
  async get(threadId: ThreadIDType): Promise<Brainstorm> {
    const client = createRailsApiClient({ jwt: this.jwt });

    const response = await client.GET("/brainstorms/{thread_id}", {
      params: {
        path: { thread_id: threadId },
      },
    });

    if (response.error) {
      throw new Error(`Failed to get brainstorm: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to get brainstorm: ${JSON.stringify(response.error)}`);
    }

    return response.data satisfies Brainstorm;
  }

  /**
   * Updates a brainstorm
   * @param threadId - The LangGraph thread ID
   * @param updates - The fields to update
   * @returns The updated brainstorm
   */
  async update(
    threadId: ThreadIDType,
    updates: UpdateBrainstormRequest["brainstorm"]
  ): Promise<Brainstorm> {
    const client = createRailsApiClient({ jwt: this.jwt });

    const response = await client.PATCH("/brainstorms/{thread_id}", {
      params: {
        path: { thread_id: threadId },
      },
      body: {
        brainstorm: updates,
      },
    });

    if (response.error) {
      throw new Error(`Failed to update brainstorm: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to update brainstorm: ${JSON.stringify(response.error)}`);
    }

    return response.data satisfies Brainstorm;
  }
}
