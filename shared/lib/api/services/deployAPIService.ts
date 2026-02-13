import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

/**
 * Type definitions for deploy operations
 */
export type CreateDeployRequest = NonNullable<
  paths["/api/v1/deploys"]["post"]["requestBody"]
>["content"]["application/json"];

export type CreateDeployResponse = NonNullable<
  paths["/api/v1/deploys"]["post"]["responses"][201]["content"]
>["application/json"];

export type GetDeployResponse = NonNullable<
  paths["/api/v1/deploys/{id}"]["get"]["responses"][200]["content"]
>["application/json"];

export type UpdateDeployResponse = NonNullable<
  paths["/api/v1/deploys/{id}"]["patch"]["responses"][200]["content"]
>["application/json"];

export type TouchDeployResponse = NonNullable<
  paths["/api/v1/deploys/{id}/touch"]["post"]["responses"][200]["content"]
>["application/json"];

export interface DeployRecord {
  id: number;
  project_id: number;
  status: string;
  current_step?: string | null;
  is_live: boolean;
  thread_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDeployParams {
  projectId: number;
  threadId: string;
}

/**
 * Service for interacting with the Rails Deploy API.
 * Can be used from both frontend and backend (langgraph).
 */
export class DeployAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  /**
   * Creates a new deploy with an associated chat.
   * Called by the deploy graph's first node (initDeploy).
   * ChatCreatable on the Deploy model auto-creates the chat.
   */
  async create({ projectId, threadId }: CreateDeployParams): Promise<DeployRecord> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/deploys", {
      body: {
        project_id: projectId,
        thread_id: threadId,
      },
    });

    if (response.error) {
      throw new Error(`Failed to create deploy: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to create deploy: No data returned");
    }

    return response.data satisfies DeployRecord;
  }

  /**
   * Retrieves a deploy by ID
   */
  async get(deployId: number): Promise<DeployRecord> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/deploys/{id}", {
      params: {
        path: { id: deployId },
      },
    });

    if (response.error) {
      throw new Error(`Failed to get deploy: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to get deploy: No data returned");
    }

    return response.data satisfies DeployRecord;
  }

  /**
   * Updates a deploy's status, step, etc.
   */
  async update(
    deployId: number,
    updates: { status?: string; current_step?: string; is_live?: boolean }
  ): Promise<DeployRecord> {
    const client = await this.getClient();
    const response = await client.PATCH("/api/v1/deploys/{id}", {
      params: {
        path: { id: deployId },
      },
      body: updates,
    });

    if (!response.data) {
      throw new Error("Failed to update deploy: No data returned");
    }

    return response.data satisfies DeployRecord;
  }

  /**
   * Updates the user_active_at timestamp for a deploy.
   * Called when the user is actively viewing the deploy page.
   */
  async touch(deployId: number): Promise<TouchDeployResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/deploys/{id}/touch", {
      params: {
        path: { id: deployId },
      },
    });

    if (response.error) {
      throw new Error(`Failed to touch deploy: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to touch deploy: No data returned");
    }

    return response.data;
  }
}
