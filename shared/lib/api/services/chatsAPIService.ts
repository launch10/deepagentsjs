import { RailsAPIBase, type paths } from "../index";
import type { Simplify } from "type-fest";

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
