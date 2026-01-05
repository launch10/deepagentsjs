import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

/**
 * Type definitions for brainstorm operations
 */
export type CreateBrainstormRequest = NonNullable<
  paths["/api/v1/brainstorms"]["post"]["requestBody"]
>["content"]["application/json"];

export type CreateBrainstormResponse = NonNullable<
  paths["/api/v1/brainstorms"]["post"]["responses"][201]["content"]
>["application/json"];

export type UpdateBrainstormRequest = NonNullable<
  paths["/api/v1/brainstorms/{thread_id}"]["patch"]["requestBody"]
>["content"]["application/json"];

export type UpdateBrainstormResponse = NonNullable<
  paths["/api/v1/brainstorms/{thread_id}"]["patch"]["responses"][200]["content"]
>["application/json"];

export type GetBrainstormResponse = NonNullable<
  paths["/api/v1/brainstorms/{thread_id}"]["get"]["responses"][200]["content"]
>["application/json"];

export interface BrainstormRecord {
  id: number;
  website_id: number;
  project_id: number;
  name: string;
  thread_id: string;
  account_id: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBrainstormParams {
  threadId: string;
  projectUUID: string;
  name?: string;
}

/**
 * Service for interacting with the Rails Brainstorm API
 * Can be used from both frontend and backend (langgraph)
 */
export class BrainstormAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  /**
   * Creates a new brainstorm
   * @param threadId - The LangGraph thread ID
   * @param projectUUID - The project UUID
   * @param name - Optional name for the brainstorm
   * @returns The created brainstorm
   */
  async create({ threadId, projectUUID, name }: CreateBrainstormParams): Promise<BrainstormRecord> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/brainstorms", {
      body: {
        brainstorm: {
          thread_id: threadId,
          project_attributes: {
            uuid: projectUUID,
          },
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

    return response.data satisfies BrainstormRecord;
  }

  /**
   * Retrieves a brainstorm by thread ID
   * @param threadId - The LangGraph thread ID
   * @returns The brainstorm
   */
  async get(threadId: string): Promise<BrainstormRecord> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/brainstorms/{thread_id}", {
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

    return response.data satisfies BrainstormRecord;
  }

  /**
   * Updates a brainstorm
   * @param threadId - The LangGraph thread ID
   * @param updates - The fields to update
   * @returns The updated brainstorm
   */
  async update(
    threadId: string,
    updates: UpdateBrainstormRequest["brainstorm"]
  ): Promise<BrainstormRecord> {
    const client = await this.getClient();
    const response = await client.PATCH("/api/v1/brainstorms/{thread_id}", {
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

    return response.data satisfies BrainstormRecord;
  }
}
