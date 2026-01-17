import type { WebsiteGraphState } from "@annotation";
import { NodeMiddleware } from "@middleware";
import { createChatNodeFactory } from "../core";

/**
 * Create a Chat record at the start of the website graph.
 * This establishes thread ownership so the auth middleware can validate
 * that subsequent requests for this thread belong to the correct account.
 *
 * Idempotent: exits early if chatId already exists in state.
 * If a Chat already exists for this thread (e.g., on reconnection),
 * the existing chat will be returned and its ID stored in state.
 */
export const createChat = NodeMiddleware.use(
  {},
  createChatNodeFactory<WebsiteGraphState>({
    chatType: "website",
    contextableType: "Website",
    getContextableId: (state) => state.websiteId,
  })
);
