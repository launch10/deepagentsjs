import { RailsAPIBase } from "../index";
import type { Simplify } from "type-fest";
import type { paths } from "../generated/rails-api";

// ============================================================================
// Type Definitions - Extracted from OpenAPI generated types
// ============================================================================

/** Request body for creating a job run */
export type CreateJobRunRequest = NonNullable<
  paths["/api/v1/job_runs"]["post"]["requestBody"]
>["content"]["application/json"];

/** Response from creating a job run */
export type CreateJobRunResponse =
  paths["/api/v1/job_runs"]["post"]["responses"]["201"]["content"]["application/json"];

// ============================================================================
// Helper Types (simpler interfaces for service usage)
// ============================================================================

/** Simple params for creating a job run (camelCase, service converts for API) */
export interface SimpleCreateJobRunParams {
  jobClass: CreateJobRunRequest["job_class"];
  arguments: Record<string, unknown>;
  threadId: string;
  /** Optional deploy ID to link this job run with a deploy for user activity tracking */
  deployId?: number;
}

// ============================================================================
// Job Run Service Class
// ============================================================================

export class JobRunAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  /**
   * Fetches the current status of a job run.
   * Used as a fallback when the webhook callback hasn't arrived.
   *
   * Uses raw fetch since this endpoint may not be in the OpenAPI spec yet.
   */
  async show(
    id: number
  ): Promise<{ id: number; status: string; result: Record<string, unknown> | null; error: string | null }> {
    const client = await this.getClient();

    // Use the typed client's GET with a cast since the endpoint may not be in the OpenAPI spec
    const response = await (client as any).GET(`/api/v1/job_runs/${id}`);

    if (response.error) {
      throw new Error(`Failed to fetch job run ${id}: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to fetch job run ${id}: No data returned`);
    }

    return response.data as { id: number; status: string; result: Record<string, unknown> | null; error: string | null };
  }

  /**
   * Creates a new job run
   * Accepts either the simple camelCase params or the full API request format
   */
  async create(
    options: SimpleCreateJobRunParams | CreateJobRunRequest
  ): Promise<CreateJobRunResponse> {
    const client = await this.getClient();

    // Convert simple params to API format if needed
    const body: CreateJobRunRequest & { deploy_id?: number } =
      "job_class" in options
        ? options
        : {
            job_class: options.jobClass,
            arguments: options.arguments,
            thread_id: options.threadId,
            ...(options.deployId && { deploy_id: options.deployId }),
          };

    const response = await client.POST("/api/v1/job_runs", {
      body,
    });

    if (response.error) {
      throw new Error(`Failed to create job run: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to create job run: No data returned");
    }

    return response.data;
  }
}
