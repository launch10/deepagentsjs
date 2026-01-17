import type { DeployGraphState } from "@annotation";
import { createChatNodeFactory } from "../core";

/**
 * Create a Chat record at the start of the deploy graph.
 * This establishes thread ownership so the auth middleware can validate
 * that subsequent requests for this thread belong to the correct account.
 *
 * Idempotent: exits early if chatId already exists in state.
 * If a Chat already exists for this thread (e.g., on reconnection),
 * the existing chat will be returned and its ID stored in state.
 */
export const createChatNode = createChatNodeFactory<DeployGraphState>({
  chatType: "deploy",
  contextableType: "Deploy",
  getContextableId: (state) => state.deployId,
});