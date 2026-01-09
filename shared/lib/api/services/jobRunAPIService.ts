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
}

// ============================================================================
// Job Run Service Class
// ============================================================================

export class JobRunAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
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
    const body: CreateJobRunRequest =
      "job_class" in options
        ? options
        : {
            job_class: options.jobClass,
            arguments: options.arguments,
            thread_id: options.threadId,
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
