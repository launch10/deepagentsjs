/**
 * Domain utility functions for working with platform and custom domains.
 */

const PLATFORM_SUFFIX = ".launch10.site";

/**
 * Check if a domain is a platform subdomain (*.launch10.site)
 */
export function isPlatformDomain(domain: string): boolean {
  return domain.endsWith(PLATFORM_SUFFIX);
}

/**
 * Extract subdomain from a full domain name.
 * For platform domains: "mysite.launch10.site" → "mysite"
 * For custom domains: "mybusiness.com" → "mybusiness"
 */
export function getSubdomain(domain: string): string {
  if (isPlatformDomain(domain)) {
    return domain.replace(PLATFORM_SUFFIX, "");
  }
  return domain.split(".")[0];
}

/**
 * Build the full URL from domain and path.
 * Normalizes path "/" to empty string for cleaner URLs.
 */
export function getFullUrl(domain: string, path: string): string {
  const normalizedPath = path === "/" ? "" : path;
  return `${domain}${normalizedPath}`;
}

/**
 * Build a platform domain from a subdomain.
 * "mysite" → "mysite.launch10.site"
 */
export function buildPlatformDomain(subdomain: string): string {
  return `${subdomain}${PLATFORM_SUFFIX}`;
}

export { PLATFORM_SUFFIX };
