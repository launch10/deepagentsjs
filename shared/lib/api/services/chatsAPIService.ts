import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

export type CreateChatRequest = NonNullable<
  paths["/api/v1/chats"]["post"]["requestBody"]
>["content"]["application/json"];

export type CreateChatResponse = NonNullable<
  paths["/api/v1/chats"]["post"]["responses"][200 | 201]["content"]["application/json"]
>;

export type ValidateChatRequest = NonNullable<
  paths["/api/v1/chats/validate"]["post"]["requestBody"]
>["content"]["application/json"];

export type ValidateChatResponse = NonNullable<
  paths["/api/v1/chats/validate"]["post"]["responses"][200]["content"]["application/json"]
>;

/**
 * Service for managing chat records in Rails.
 * Chats link Langgraph threads to accounts and projects for thread ownership validation.
 */
export class ChatsAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  /**
   * Create a new chat record to establish thread ownership.
   * This should be called at the start of website/deploy graphs.
   */
  async create(params: CreateChatRequest): Promise<CreateChatResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/chats", {
      body: params,
    });

    if (response.error) {
      throw new Error(`Failed to create chat: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to create chat: No data returned");
    }

    return response.data satisfies CreateChatResponse;
  }

  /**
   * Validate if a thread belongs to the current account.
   * Returns validation result indicating if thread is valid for current account.
   */
  async validate(params: ValidateChatRequest): Promise<ValidateChatResponse> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/chats/validate", {
      body: params,
    });

    if (response.error) {
      throw new Error(`Failed to validate chat: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error("Failed to validate chat: No data returned");
    }

    return response.data satisfies ValidateChatResponse;
  }
}
