/**
 * Domain and path validation utilities for the domain picker.
 *
 * These validation rules match the backend validation in:
 * - app/models/domain.rb
 * - app/models/website_url.rb
 */

// ============================================================================
// Regex Patterns
// ============================================================================

/**
 * Validates subdomain format (e.g., "my-site" for my-site.launch10.site)
 * - Lowercase letters, numbers, and hyphens only
 * - Cannot start or end with hyphen
 * - Single character subdomains allowed
 */
export const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

/**
 * Validates custom domain format (e.g., "example.com", "sub.example.com")
 * - Standard domain name format
 * - TLD must be at least 2 characters
 */
export const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/**
 * Validates path format (e.g., "/landing", "/promo")
 * - Must start with /
 * - Lowercase letters, numbers, and hyphens only
 */
export const PATH_REGEX = /^\/[a-z0-9-]*$/;

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates a subdomain (the part before .launch10.site)
 * @param value - The subdomain to validate (e.g., "my-site")
 */
export function validateSubdomain(value: string): ValidationResult {
  if (!value) {
    return { valid: false };
  }

  if (value.length > 63) {
    return { valid: false, error: "Max 63 characters" };
  }

  if (!SUBDOMAIN_REGEX.test(value)) {
    return { valid: false, error: "Only lowercase letters, numbers, and hyphens" };
  }

  if (value.startsWith("-") || value.endsWith("-")) {
    return { valid: false, error: "Cannot start or end with hyphen" };
  }

  return { valid: true };
}

/**
 * Validates a custom domain (user's own domain like example.com)
 * @param value - The full domain to validate
 * @param options.allowPlatformDomain - If false, rejects .launch10.site domains (default: false)
 */
export function validateDomain(
  value: string,
  options: { allowPlatformDomain?: boolean } = {}
): ValidationResult {
  const { allowPlatformDomain = false } = options;

  if (!value) {
    return { valid: false };
  }

  if (value.length > 253) {
    return { valid: false, error: "Domain too long" };
  }

  if (!allowPlatformDomain && value.endsWith(".launch10.site")) {
    return { valid: false, error: "Use 'Create New Site' for launch10.site domains" };
  }

  if (!DOMAIN_REGEX.test(value.toLowerCase())) {
    return { valid: false, error: "Enter a valid domain (e.g., example.com)" };
  }

  return { valid: true };
}

/**
 * Validates a URL path (e.g., "/landing", "/promo")
 * @param value - The path to validate (must start with /)
 */
export function validatePath(value: string): ValidationResult {
  // Root path is always valid
  if (value === "/") {
    return { valid: true };
  }

  // Must start with /
  if (!value.startsWith("/")) {
    return { valid: false, error: "Path must start with /" };
  }

  // Single-level only (no nested paths)
  const pathPart = value.slice(1);
  if (pathPart.includes("/")) {
    return { valid: false, error: "Only single-level paths allowed (e.g., /landing)" };
  }

  // Check characters
  if (!PATH_REGEX.test(value)) {
    return { valid: false, error: "Only lowercase letters, numbers, and hyphens" };
  }

  // Max length
  if (pathPart.length > 50) {
    return { valid: false, error: "Max 50 characters" };
  }

  return { valid: true };
}
