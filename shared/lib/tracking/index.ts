/**
 * L10 Tracking Types
 *
 * Type definitions for conversion tracking.
 * The actual implementation lives in rails_app/templates/default/src/lib/tracking.ts
 */

export const TrackingLabels = ["signup", "lead", "purchase", "download"] as const;
export type TrackingLabel = (typeof TrackingLabels)[number];

export interface ConversionConfig {
  googleAdsId?: string;
  conversionLabels?: Record<string, string>;
}

export interface ConversionProperties {
  label: TrackingLabel;
  value?: number;
  currency?: string;
}
