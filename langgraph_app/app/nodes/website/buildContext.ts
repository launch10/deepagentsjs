import type { WebsiteGraphState } from "@annotation";
import { NodeMiddleware } from "@middleware";

/**
 * Build context node - sets status to running.
 *
 * Note: Brainstorm and image context for the coding agent now comes from events
 * (brainstorm.finished, images.created) via injectAgentContext, not from state.
 * Domain recommendations node fetches brainstorm context directly when needed.
 */
export const buildContext = NodeMiddleware.use(
  {},
  async (_state: WebsiteGraphState): Promise<Partial<WebsiteGraphState>> => {
    return {
      status: "running",
    };
  }
);
