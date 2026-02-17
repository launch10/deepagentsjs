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

export type DeactivateDeployResponse = NonNullable<
  paths["/api/v1/deploys/deactivate"]["post"]["responses"][200]["content"]
>["application/json"];

export type RollbackDeployResponse = NonNullable<
  paths["/api/v1/deploys/{id}/rollback"]["post"]["responses"][200]["content"]
>["application/json"];

/** Full response type from GET /api/v1/deploys */
export type DeploysListResponse = NonNullable<
  paths["/api/v1/deploys"]["get"]["responses"][200]["content"]
>["application/json"];

/** Request parameters for GET /api/v1/deploys */
export type GetDeploysRequest = paths["/api/v1/deploys"]["get"]["parameters"]["query"];

export interface DeployRecord {
  id: number;
  project_id: number;
  status: string;
  current_step?: string | null;
  is_live: boolean;
  thread_id?: string | null;
  instructions?: Record<string, boolean>;
  support_ticket?: string | null;
  revertible?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateDeployParams {
  projectId: number;
  threadId: string;
  instructions?: Record<string, boolean>;
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
   * Lists paginated deploys for a project, with optional status filtering.
   */
  async list(params: GetDeploysRequest): Promise<DeploysListResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/deploys", {
      params: { query: params },
    });

    if (response.error) {
      throw new Error(`Failed to list deploys: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to list deploys: No data returned");
    }

    return response.data;
  }

  /**
   * Creates a new deploy with a thread_id stored directly on the record.
   * Called by the deploy graph's first node (initDeploy).
   */
  async create({ projectId, threadId, instructions }: CreateDeployParams): Promise<DeployRecord> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/deploys", {
      body: {
        project_id: projectId,
        thread_id: threadId,
        instructions: instructions ?? {},
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
    updates: { status?: string; current_step?: string; is_live?: boolean; needs_support?: boolean; stacktrace?: string }
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
   * Checks whether content has changed since the last deploy.
   * Returns granular flags per instruction type (true = changed, false = unchanged).
   */
  async checkChanges(
    projectId: number,
    instructions: Record<string, boolean>
  ): Promise<{ website?: boolean; campaign?: boolean }> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/deploys/check_changes" as any, {
      body: {
        project_id: projectId,
        instructions,
      },
    });

    if (response.error) {
      throw new Error(`Failed to check changes: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to check changes: No data returned");
    }

    return response.data as { website?: boolean; campaign?: boolean };
  }

  /**
   * Deactivates the active deploy for a project.
   */
  async deactivate(projectId: number): Promise<DeactivateDeployResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/deploys/deactivate", {
      body: { project_id: projectId },
    });

    if (response.error) {
      throw new Error(`Failed to deactivate deploy: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to deactivate deploy: No data returned");
    }

    return response.data;
  }

  /**
   * Rolls back a completed deploy to a previous version.
   */
  async rollback(deployId: number): Promise<RollbackDeployResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/deploys/{id}/rollback", {
      params: {
        path: { id: deployId },
      },
    });

    if (response.error) {
      throw new Error(`Failed to rollback deploy: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to rollback deploy: No data returned");
    }

    return response.data;
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
