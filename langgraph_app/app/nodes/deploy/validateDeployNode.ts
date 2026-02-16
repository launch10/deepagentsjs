import { type DeployGraphState } from "@annotation";
import { getLogger } from "@core";
import { db, websiteUrls, eq, and } from "@db";
import { isNull } from "drizzle-orm";

/**
 * Validates preconditions before starting the deploy pipeline.
 *
 * Runs before createDeploy — if validation fails, the graph exits early
 * without creating a deploy record or running any tasks.
 *
 * Checks:
 * - When deploying a website, a website_url (domain) must be assigned
 */
export async function validateDeployNode(
  state: DeployGraphState
): Promise<Partial<DeployGraphState>> {
  const log = getLogger({ component: "validateDeployNode" });

  if (state.instructions?.website && state.websiteId) {
    const [websiteUrl] = await db
      .select({ id: websiteUrls.id })
      .from(websiteUrls)
      .where(and(eq(websiteUrls.websiteId, state.websiteId), isNull(websiteUrls.deletedAt)))
      .limit(1);

    if (!websiteUrl) {
      log.warn(
        { websiteId: state.websiteId },
        "No website_url assigned — cannot deploy without a domain"
      );
      return {
        status: "failed",
        error: {
          message: "No website_url assigned — choose a domain before deploying",
          node: "validateDeployNode",
        },
      };
    }
  }

  log.info("Deploy validation passed");
  return {};
}
