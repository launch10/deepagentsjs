import { NodeMiddleware } from "@middleware";
import { type BrainstormGraphState } from "@state";

/**
 * Post-agent cleanup node. Resets ephemeral state that was already
 * streamed to the frontend so it doesn't replay on navigation.
 */
export const cleanup = NodeMiddleware.use(
  {},
  async (
    _state: BrainstormGraphState
  ): Promise<Partial<BrainstormGraphState>> => {
    return { agentIntents: [] };
  }
);
