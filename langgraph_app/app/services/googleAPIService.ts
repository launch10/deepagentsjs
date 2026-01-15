import { RailsAPIBase, type Options } from "@rails_api";

/**
 * Response from GET /api/v1/google/connection_status
 */
export interface GoogleConnectionStatus {
  connected: boolean;
  email: string | null;
}

/**
 * Response from GET /api/v1/google/invite_status
 */
export interface GoogleInviteStatus {
  accepted: boolean;
  status: string;
  email: string | null;
}

/**
 * Response from GET /api/v1/google/payment_status
 */
export interface GooglePaymentStatus {
  has_payment: boolean;
  status: string;
}

/**
 * Service for checking Google OAuth and Ads invite status
 *
 * Used by the deploy graph to determine if Google connect/verify
 * steps should be skipped.
 */
export class GoogleAPIService extends RailsAPIBase {
  constructor(options: Options) {
    super(options);
  }

  /**
   * Check if account has connected Google OAuth
   * Used by shouldSkipGoogleConnect routing
   */
  async getConnectionStatus(): Promise<GoogleConnectionStatus> {
    const client = await this.getClient();

    // Use manual fetch since this endpoint isn't in generated types yet
    const response = await client.GET("/api/v1/google/connection_status" as any, {});

    if (response.error) {
      throw new Error(`Failed to get connection status: ${JSON.stringify(response.error)}`);
    }

    return response.data as GoogleConnectionStatus;
  }

  /**
   * Check if Google Ads invite has been accepted
   * Used by shouldSkipGoogleVerify routing
   */
  async getInviteStatus(): Promise<GoogleInviteStatus> {
    const client = await this.getClient();

    // Use manual fetch since this endpoint isn't in generated types yet
    const response = await client.GET("/api/v1/google/invite_status" as any, {});

    if (response.error) {
      throw new Error(`Failed to get invite status: ${JSON.stringify(response.error)}`);
    }

    return response.data as GoogleInviteStatus;
  }

  /**
   * Check if Google Ads has a payment method configured
   * Used by shouldCheckPayment routing
   */
  async getPaymentStatus(): Promise<GooglePaymentStatus> {
    const client = await this.getClient();

    // Use manual fetch since this endpoint isn't in generated types yet
    const response = await client.GET("/api/v1/google/payment_status" as any, {});

    if (response.error) {
      throw new Error(`Failed to get payment status: ${JSON.stringify(response.error)}`);
    }

    return response.data as GooglePaymentStatus;
  }
}
