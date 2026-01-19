import { RailsAPIBase } from "../index";

// ============================================================================
// Deploy Service Class
// ============================================================================

export class DeployAPIService extends RailsAPIBase {
  /**
   * Updates the user_active_at timestamp for a deploy
   * Called when the user is actively viewing the deploy page
   *
   * Note: This endpoint is not in the generated OpenAPI types yet, so we use
   * type assertions to bypass TypeScript's strict checking.
   *
   * @param deployId - The ID of the deploy to touch
   */
  async touch(deployId: number): Promise<{ touched_at: string }> {
    const client = await this.getClient();

    // Use the client directly - cast to any since endpoint isn't in generated types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (client as any).POST(`/api/v1/deploys/${deployId}/touch`, {});

    if (response.error) {
      throw new Error(`Failed to touch deploy: ${JSON.stringify(response.error)}`);
    }

    return response.data as { touched_at: string };
  }
}
