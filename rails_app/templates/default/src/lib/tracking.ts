/**
 * L10 Lead Capture & Conversion Tracking
 *
 * Simple API for landing pages:
 * - L10.createLead(email, { value }) - Submit lead + track conversion
 *
 * All config via environment variables (injected at build time):
 * - VITE_API_BASE_URL
 * - VITE_SIGNUP_TOKEN
 * - VITE_GOOGLE_ADS_ID
 * - VITE_GOOGLE_ADS_SEND_TO
 */

export class LeadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadError";
  }
}

// Extend globalThis for browser environment
declare const window: {
  gtag?: (...args: unknown[]) => void;
} | undefined;

export const L10 = {
  /**
   * Create a lead and track the conversion.
   * Resolves on success, rejects on failure.
   *
   * @example
   * L10.createLead(email).then(showSuccess).catch(showError);
   * L10.createLead(email, { value: 99 }).then(showSuccess).catch(showError);
   */
  async createLead(
    email: string,
    options?: { value?: number; name?: string }
  ): Promise<void> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const signupToken = import.meta.env.VITE_SIGNUP_TOKEN;
    const googleAdsId = import.meta.env.VITE_GOOGLE_ADS_ID;

    if (!apiBaseUrl || !signupToken) {
      console.error("[L10] Missing VITE_API_BASE_URL or VITE_SIGNUP_TOKEN");
      throw new LeadError("Configuration error");
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: options?.name,
          token: signupToken,
        }),
      });

      if (response.ok) {
        // Fire Google Ads conversion on success
        if (typeof window !== 'undefined' && window.gtag && googleAdsId) {
          window.gtag("event", "conversion", {
            send_to: `${googleAdsId}/signup`,
            value: options?.value ?? 0,
            currency: "USD",
          });
        }
        return;
      }

      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new LeadError(data.error || "Signup failed");
    } catch (error) {
      if (error instanceof LeadError) throw error;
      throw new LeadError("Network error");
    }
  },
};
