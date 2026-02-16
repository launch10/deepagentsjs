import { type DeployGraphState } from "@annotation";
import { getLogger } from "@core";
import { db, websiteUrls, eq, and } from "@db";
import { isNull } from "drizzle-orm";
import { Deploy } from "@types";
import { CampaignAPIService } from "@services";
import { DeployAPIService } from "@rails_api";

/**
 * Validates preconditions before starting the deploy pipeline.
 *
 * Runs before createDeploy — if validation fails, the graph exits early
 * without creating a deploy record or running any tasks.
 *
 * Checks:
 * - When deploying a website, a website_url (domain) must be assigned
 * - When deploying Google Ads, the campaign must have all required data
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

  if (Deploy.shouldDeployGoogleAds(state) && state.campaignId) {
    const campaignAPI = new CampaignAPIService({ jwt: state.jwt });
    const result = await campaignAPI.validateDeploy(state.campaignId);

    if (!result.valid) {
      log.warn(
        { campaignId: state.campaignId, errors: result.errors },
        "Campaign not ready for deploy"
      );
      return {
        status: "failed",
        error: {
          message: `Campaign is not ready to deploy: ${result.errors.join(", ")}`,
          node: "validateDeployNode",
        },
      };
    }
  }

  log.info("Deploy validation passed");

  // Change detection: check if content has actually changed since last deploy
  if (state.projectId && state.jwt) {
    try {
      const deployAPI = new DeployAPIService({ jwt: state.jwt });

      // Map instruction keys to Rails API format (googleAds → google_ads)
      const apiInstructions: Record<string, boolean> = {};
      if (state.instructions?.website) apiInstructions.website = true;
      if (state.instructions?.googleAds) apiInstructions.google_ads = true;

      const changes = await deployAPI.checkChanges(state.projectId as number, apiInstructions);
      log.info({ changes }, "Change detection result");

      // Check if ALL values are false (nothing changed)
      const changedValues = Object.values(changes);
      const nothingChanged = changedValues.length > 0 && changedValues.every((v) => v === false);

      if (nothingChanged) {
        log.info("Nothing changed since last deploy, skipping");
        return { nothingChanged: true };
      }

      // Partial changes: narrow instructions for unchanged items
      const narrowedInstructions = { ...state.instructions };
      if (changes.website === false && narrowedInstructions.website) {
        log.info("Website unchanged, narrowing instructions");
        narrowedInstructions.website = false;
      }
      if (changes.campaign === false && narrowedInstructions.googleAds) {
        log.info("Campaign unchanged, narrowing instructions");
        narrowedInstructions.googleAds = false;
      }

      // Only return narrowed instructions if something actually changed
      if (JSON.stringify(narrowedInstructions) !== JSON.stringify(state.instructions)) {
        return { instructions: narrowedInstructions };
      }
    } catch (error) {
      log.warn({ error }, "Change detection failed, proceeding with full deploy");
    }
  }

  return {};
}
