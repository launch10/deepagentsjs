/**
 * L10 Conversion Tracking
 *
 * Provides Google Ads conversion tracking for landing pages.
 * Configured via window.L10_CONFIG injected by instrumentationNode.
 */

interface ConversionConfig {
  googleAdsId?: string;
  conversionLabels?: Record<string, string>;
}

interface ConversionProperties {
  label: string; // Semantic label: "signup", "lead", "purchase", "download"
  value?: number; // Conversion value for ROAS calculation
  currency?: string; // Default: USD
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    L10: typeof L10;
    L10_CONFIG?: ConversionConfig;
  }
}

export const L10 = {
  _config: {} as ConversionConfig,

  /**
   * Initialize L10 with configuration.
   * Called automatically if window.L10_CONFIG is present.
   */
  init(config?: ConversionConfig) {
    this._config = { ...window.L10_CONFIG, ...config };
  },

  /**
   * Create a lead and track conversion.
   * This is the primary method for capturing email signups.
   *
   * @example
   * // Simple waitlist signup
   * await L10.createLead(email);
   *
   * // Tiered pricing signup with value
   * await L10.createLead(email, { value: 99 });
   */
  async createLead(email: string, options?: { value?: number }): Promise<void> {
    // Submit to backend API
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, value: options?.value }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit lead');
    }

    // Track conversion on success
    this.conversion({
      label: 'lead',
      value: options?.value,
      currency: 'USD',
    });
  },

  /**
   * Track a conversion event.
   *
   * @example
   * // Signup with no monetary value
   * L10.conversion({ label: 'signup' });
   *
   * // Lead with estimated value
   * L10.conversion({ label: 'lead', value: 50, currency: 'USD' });
   *
   * // Purchase with actual value
   * L10.conversion({ label: 'purchase', value: 99.99, currency: 'USD' });
   */
  conversion(properties: ConversionProperties) {
    // Lookup the actual Google Ads conversion label from our semantic label
    const label =
      this._config.conversionLabels?.[properties.label] || properties.label;

    if (window.gtag && this._config.googleAdsId) {
      window.gtag("event", "conversion", {
        send_to: `${this._config.googleAdsId}/${label}`,
        value: properties.value,
        currency: properties.currency || "USD",
      });
    }

    // Log in development for debugging
    if (import.meta.env.DEV) {
      console.log("[L10.conversion]", properties);
    }
  },
};

// Auto-initialize when loaded in browser
if (typeof window !== "undefined") {
  window.L10 = L10;
  if (window.L10_CONFIG) L10.init();
}
