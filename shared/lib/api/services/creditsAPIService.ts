import { RailsAPIBase, type paths } from "../index";
import type { Options } from "../railsApiBase";
import type { Simplify } from "type-fest";

/**
 * Type definitions for credit operations, derived from generated API paths
 */
export type CheckCreditsResponse = NonNullable<
  paths["/api/v1/credits/check"]["get"]["responses"][200]["content"]
>["application/json"];

/**
 * Service for interacting with the Rails Credits API
 * Can be used from both frontend and backend (langgraph)
 */
export class CreditsAPIService extends RailsAPIBase {
  private jwt: string;

  constructor(options: Simplify<Options> & { jwt: string }) {
    super(options);
    this.jwt = options.jwt;
  }

  /**
   * Check the account's credit balance
   * @returns Credit balance breakdown
   */
  async check(): Promise<CheckCreditsResponse> {
    const client = await this.getClient();
    const response = await client.GET("/api/v1/credits/check", {
      params: {
        header: {
          Authorization: `Bearer ${this.jwt}`,
        },
      },
    });

    if (response.error) {
      throw new Error(`Credit check failed: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Credit check failed: ${JSON.stringify(response.error)}`);
    }

    return response.data satisfies CheckCreditsResponse;
  }
}
