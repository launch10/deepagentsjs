import { RailsAPIBase, type Options, type paths } from "@rails_api";

/**
 * Response from GET /api/v1/google/status
 * Unified Google onboarding status (connection, invite, billing)
 */
export type GoogleStatus = NonNullable<
  paths["/api/v1/google/status"]["get"]["responses"][200]["content"]
>["application/json"];

/**
 * Response from POST /api/v1/google/refresh_invite_status
 */
export type GoogleRefreshInviteStatus = NonNullable<
  paths["/api/v1/google/refresh_invite_status"]["post"]["responses"][200]["content"]
>["application/json"];

/**
 * Service for checking Google OAuth and Ads status
 *
 * Uses a single unified endpoint for all status checks.
 * The refresh endpoint is separate because it has side effects.
 */
export class GoogleAPIService extends RailsAPIBase {
  constructor(options: Options) {
    super(options);
  }

  /**
   * Get all Google onboarding statuses in a single call.
   * Used by initPhasesNode, shouldSkip checks, and self-heal paths.
   */
  async getGoogleStatus(): Promise<GoogleStatus> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/google/status", {});

    if (response.error) {
      throw new Error(`Failed to get Google status: ${JSON.stringify(response.error)}`);
    }

    return response.data!;
  }

  /**
   * Live-refresh invite status from Google and return result.
   * If accepted, Rails completes the JobRun. If not, enqueues a quick follow-up poll.
   */
  async refreshInviteStatus(jobRunId?: number): Promise<GoogleRefreshInviteStatus> {
    const client = await this.getClient();

    const response = await client.POST("/api/v1/google/refresh_invite_status", {
      body: { job_run_id: jobRunId },
    });

    if (response.error) {
      throw new Error(`Failed to refresh invite status: ${JSON.stringify(response.error)}`);
    }

    return response.data!;
  }
}
