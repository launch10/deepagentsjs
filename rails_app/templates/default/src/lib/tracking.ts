/**
 * L10 Conversion Tracking
 *
 * Provides Google Ads conversion tracking for landing pages.
 * Configured via window.L10_CONFIG injected at build time.
 *
 * This file is self-contained for deployment to user pages.
 */

export interface ConversionConfig {
  googleAdsId?: string;
  conversionLabels?: Record<string, string>;
}

export const TrackingLabels = ["signup", "lead", "purchase", "download"] as const;
export type TrackingLabel = (typeof TrackingLabels)[number];

export const CurrencyLabels = ["USD"] as const;
export type CurrencyLabel = (typeof CurrencyLabels)[number];

export interface ConversionProperties {
  label: TrackingLabel;
  value?: number; // Conversion value for ROAS calculation
  currency?: CurrencyLabel;
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
   * Track a conversion event.
   *
   * @example
   * // Signup with no monetary value
   * L10.conversion({ label: 'signup' });
   *
   * // Tiered pricing with value
   * L10.conversion({ label: 'signup', value: 99 });
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
