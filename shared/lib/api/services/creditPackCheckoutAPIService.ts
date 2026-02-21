import { RailsAPIBase } from "../index";
import type { Options } from "../railsApiBase";
import type { Simplify } from "type-fest";

export interface CreditPackCheckoutResponse {
  client_secret: string;
}

/**
 * Service for interacting with the Rails Credit Pack Checkouts API
 */
export class CreditPackCheckoutAPIService extends RailsAPIBase {
  constructor(options: Simplify<Options>) {
    super(options);
  }

  /**
   * Create a Stripe checkout session for a credit pack
   * @param creditPackId - The credit pack to purchase
   * @returns Stripe checkout session client secret
   */
  async checkout(creditPackId: number): Promise<CreditPackCheckoutResponse> {
    const client = await this.getClient();
    const response = await client.POST(
      "/api/v1/credit_packs/{credit_pack_id}/checkout",
      {
        params: {
          path: { credit_pack_id: creditPackId },
        } as any,
      },
    );

    if (response.error) {
      throw new Error(
        `Checkout failed: ${JSON.stringify(response.error)}`,
      );
    }

    if (!response.data) {
      throw new Error("Checkout failed: no data returned");
    }

    return response.data as CreditPackCheckoutResponse;
  }
}
