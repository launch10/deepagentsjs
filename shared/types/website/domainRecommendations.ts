/**
 * Domain recommendations types for the subdomain picker.
 * These are computed by the domainRecommendations graph node.
 */

export type UIState =
  | "no_existing_sites"
  | "existing_recommended"
  | "new_recommended"
  | "out_of_credits_no_match";

export type AvailabilityStatus = "available" | "existing" | "unavailable" | "unknown";

export interface DomainRecommendation {
  domain: string;
  subdomain: string;
  path: string; // e.g., "/landing", "/"
  fullUrl: string; // e.g., "mysite.launch10.site/landing"
  score: number;
  reasoning: string;
  source: "existing" | "suggestion";
  existingDomainId?: number; // Domain ID for existing domains - used with search_paths
  availability?: AvailabilityStatus;
}

export interface DomainRecommendations {
  state: UIState;
  recommendations: DomainRecommendation[];
  topRecommendation: DomainRecommendation | null;
}