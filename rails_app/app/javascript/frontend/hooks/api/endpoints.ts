/**
 * API endpoint definitions for campaigns.
 * Centralizes all URL patterns to avoid magic strings throughout the codebase.
 */
export const campaignEndpoints = {
  list: "/api/v1/campaigns",
  detail: (id: number) => `/api/v1/campaigns/${id}`,
  advance: (id: number) => `/api/v1/campaigns/${id}/advance`,
  back: (id: number) => `/api/v1/campaigns/${id}/back`,
} as const;
