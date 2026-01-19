import type { WebsiteGraphState } from "@annotation";
import type { Brainstorm } from "@types";
import { NodeMiddleware } from "@middleware";
import { ContextAPIService } from "@rails_api";

/**
 * Build context for the coding agent on the WebsiteBuilder page.
 *
 * Fetches brainstorm content and uploads (with proper URLs) from Rails API.
 * Theme is fetched separately in the coding agent since it needs the full CSS variables.
 */
export const buildContext = NodeMiddleware.use(
  {},
  async (state: WebsiteGraphState): Promise<Partial<WebsiteGraphState>> => {
    if (!state.websiteId) {
      throw new Error("websiteId is required");
    }

    if (!state.jwt) {
      throw new Error("jwt is required");
    }

    const contextAPI = new ContextAPIService({ jwt: state.jwt });
    const context = await contextAPI.get(state.websiteId);

    const images = context.uploads.map((upload) => ({
      url: upload.url,
      isLogo: upload.is_logo,
      faviconUrl: upload.favicon_url,
    }));

    const brainstormContext: Brainstorm.MemoriesType = {
      idea: context.brainstorm?.idea ?? null,
      audience: context.brainstorm?.audience ?? null,
      solution: context.brainstorm?.solution ?? null,
      socialProof: context.brainstorm?.social_proof ?? null,
    };

    return {
      brainstorm: brainstormContext,
      images,
      status: "running",
    };
  }
);
