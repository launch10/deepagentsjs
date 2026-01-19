import type { CoreGraphState, PrimaryKeyType } from "@types";
import { ChatsAPIService } from "@rails_api";

/**
 * Chat types that map to Rails Chat.CHAT_TYPES
 */
export type ChatType = "brainstorm" | "website" | "ad_campaign" | "deploy";

/**
 * Contextable types for polymorphic association
 */
export type ContextableType = "Brainstorm" | "Website" | "Campaign" | "Deploy";

/**
 * Configuration for creating a chat node
 */
export interface CreateChatNodeConfig<TState extends CoreGraphState> {
  /** The chat type (e.g., "website", "deploy", "brainstorm") */
  chatType: ChatType;
  /** The contextable type for polymorphic association (e.g., "Website", "Deploy") */
  contextableType: ContextableType;
  /** Function to extract the contextable ID from state */
  getContextableId: (state: TState) => PrimaryKeyType | undefined;
}

/**
 * Factory to create a chat node for thread ownership validation.
 *
 * Creates a Chat record at the start of a graph to establish thread ownership.
 * This allows the auth middleware to validate that subsequent requests for
 * this thread belong to the correct account.
 *
 * Features:
 * - Idempotent: exits early if chatId already exists in state
 * - Validates required fields before making API call
 * - Returns existing chat if thread already exists for same account
 *
 * @example
 * ```ts
 * // For website graph:
 * const createChat = createChatNodeFactory({
 *   chatType: "website",
 *   contextableType: "Website",
 *   getContextableId: (state) => state.websiteId,
 * });
 *
 * // For deploy graph:
 * const createChatNode = createChatNodeFactory({
 *   chatType: "deploy",
 *   contextableType: "Deploy",
 *   getContextableId: (state) => state.deployId,
 * });
 * ```
 */
export function createChatNodeFactory<TState extends CoreGraphState>(
  config: CreateChatNodeConfig<TState>
) {
  const { chatType, contextableType, getContextableId } = config;

  return async (state: TState): Promise<Partial<TState>> => {
    // Idempotency: skip if chatId already exists
    if (state.chatId) {
      return {} as Partial<TState>;
    }

    const contextableId = getContextableId(state);

    // Validate required fields - throw if missing
    const missingFields: string[] = [];
    if (!state.threadId) missingFields.push("threadId");
    if (!state.projectId) missingFields.push("projectId");
    if (!state.jwt) missingFields.push("jwt");
    if (!contextableId) missingFields.push(`contextableId (${contextableType})`);

    if (missingFields.length > 0) {
      throw new Error(
        `Cannot create ${chatType} chat: missing required fields: ${missingFields.join(", ")}`
      );
    }

    // At this point, all required fields are validated to exist
    const chatsAPI = new ChatsAPIService({ jwt: state.jwt! });

    const chat = await chatsAPI.create({
      chat: {
        thread_id: state.threadId!,
        chat_type: chatType,
        project_id: state.projectId!,
        contextable_type: contextableType,
        contextable_id: contextableId!,
      },
    });

    return { chatId: chat.id } as Partial<TState>;
  };
}
