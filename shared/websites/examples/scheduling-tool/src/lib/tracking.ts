/**
 * L10 Lead Capture, Conversion Tracking & Analytics
 *
 * Simple API for landing pages:
 * - L10.createLead(email, { value }) - Submit lead + track conversion
 * - L10.trackEvent(name, properties) - Track custom event
 *
 * All config via environment variables (injected at build time):
 * - VITE_API_BASE_URL
 * - VITE_SIGNUP_TOKEN
 * - VITE_GOOGLE_ADS_SEND_TO
 */

export class LeadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadError";
  }
}

// Minimal browser type declarations for environments without DOM lib
interface BrowserStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface BrowserLocation {
  href: string;
  search: string;
  pathname: string;
}

// Extend globalThis for browser environment
// When window exists, location and storage always exist in browsers
declare const window:
  | {
      gtag?: (...args: unknown[]) => void;
      localStorage: BrowserStorage;
      sessionStorage: BrowserStorage;
      location: BrowserLocation;
    }
  | undefined;

declare const document:
  | {
      referrer: string;
      readyState: string;
      addEventListener(event: string, callback: () => void): void;
    }
  | undefined;

// Helper to get URL parameters
function getParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

// Get gclid from URL or sessionStorage
function getGclid(): string | null {
  if (typeof window === "undefined") return null;

  const urlParams = new URLSearchParams(window.location.search);
  const gclid = urlParams.get("gclid");

  if (gclid) {
    window.sessionStorage?.setItem("gclid", gclid);
    return gclid;
  }

  return window.sessionStorage?.getItem("gclid") || null;
}

export const L10 = {
  /**
   * Get or create a persistent visitor token (stored in localStorage).
   * This identifies a unique browser across sessions.
   */
  getVisitorToken(): string {
    if (typeof window === "undefined") return "";

    let token = window.localStorage?.getItem("l10_visitor");
    if (!token) {
      token = crypto.randomUUID();
      window.localStorage?.setItem("l10_visitor", token);
    }
    return token;
  },

  /**
   * Get or create a session visit token (stored in sessionStorage).
   * This identifies a single visit/session.
   */
  getVisitToken(): string {
    if (typeof window === "undefined") return "";

    let token = window.sessionStorage?.getItem("l10_visit");
    if (!token) {
      token = crypto.randomUUID();
      window.sessionStorage?.setItem("l10_visit", token);
    }
    return token;
  },

  /**
   * Track a visit to the page.
   * Should be called once when the page loads.
   */
  async trackVisit(): Promise<void> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const signupToken = import.meta.env.VITE_SIGNUP_TOKEN;

    if (!apiBaseUrl || !signupToken) {
      console.warn("[L10] Missing VITE_API_BASE_URL or VITE_SIGNUP_TOKEN - skipping visit tracking");
      return;
    }

    try {
      await fetch(`${apiBaseUrl}/api/v1/tracking/visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: signupToken,
          visitor_token: this.getVisitorToken(),
          visit_token: this.getVisitToken(),
          referrer: document?.referrer,
          landing_page: window?.location.href,
          utm_source: getParam("utm_source"),
          utm_medium: getParam("utm_medium"),
          utm_campaign: getParam("utm_campaign"),
          utm_content: getParam("utm_content"),
          utm_term: getParam("utm_term"),
          gclid: getGclid(),
        }),
      });
    } catch (error) {
      console.warn("[L10] Failed to track visit:", error);
    }
  },

  /**
   * Track a custom event.
   *
   * @example
   * L10.trackEvent("button_click", { button: "cta" });
   * L10.trackEvent("scroll_depth", { depth: 50 });
   */
  async trackEvent(
    name: string,
    properties?: Record<string, unknown>
  ): Promise<void> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const signupToken = import.meta.env.VITE_SIGNUP_TOKEN;

    if (!apiBaseUrl || !signupToken) {
      console.warn("[L10] Missing VITE_API_BASE_URL or VITE_SIGNUP_TOKEN - skipping event tracking");
      return;
    }

    try {
      await fetch(`${apiBaseUrl}/api/v1/tracking/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: signupToken,
          visitor_token: this.getVisitorToken(),
          visit_token: this.getVisitToken(),
          name,
          properties: properties || {},
          time: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.warn("[L10] Failed to track event:", error);
    }
  },

  /**
   * Create a lead and track the conversion.
   * Resolves on success, rejects on failure.
   *
   * @example
   * L10.createLead(email).then(showSuccess).catch(showError);
   * L10.createLead(email, { value: 99 }).then(showSuccess).catch(showError);
   * L10.createLead(email, { value: 99, currency: "EUR" }).then(showSuccess).catch(showError);
   */
  async createLead(
    email: string,
    options?: { value?: number; currency?: string; name?: string }
  ): Promise<void> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const signupToken = import.meta.env.VITE_SIGNUP_TOKEN;
    const googleAdsSendTo = import.meta.env.VITE_GOOGLE_ADS_SEND_TO;

    if (!apiBaseUrl || !signupToken) {
      console.error("[L10] Missing VITE_API_BASE_URL or VITE_SIGNUP_TOKEN");
      throw new LeadError("Configuration error");
    }

    const conversionValue = options?.value;
    const conversionCurrency = options?.currency || "USD";

    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: options?.name,
          token: signupToken,
          visitor_token: this.getVisitorToken(),
          visit_token: this.getVisitToken(),
          gclid: getGclid(),
          conversion_value: conversionValue,
          conversion_currency: conversionValue !== undefined ? conversionCurrency : undefined,
          utm_source: getParam("utm_source"),
          utm_medium: getParam("utm_medium"),
          utm_campaign: getParam("utm_campaign"),
          utm_content: getParam("utm_content"),
          utm_term: getParam("utm_term"),
        }),
      });

      if (response.ok) {
        // Fire Google Ads conversion on success
        if (typeof window !== "undefined" && window.gtag && googleAdsSendTo) {
          window.gtag("event", "conversion", {
            send_to: googleAdsSendTo,
            value: conversionValue ?? 0,
            currency: conversionCurrency,
          });
        }
        return;
      }

      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new LeadError(data.error || "Signup failed");
    } catch (error) {
      if (error instanceof LeadError) throw error;
      throw new LeadError("Network error");
    }
  },
};

// Auto-track visit and page view on load
if (typeof window !== "undefined" && typeof document !== "undefined") {
  const doc = document; // Narrow type after undefined check
  // Wait for DOM to be ready before tracking
  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", () => {
      L10.trackVisit().then(() => {
        L10.trackEvent("page_view", { path: window?.location.pathname });
      });
    });
  } else {
    L10.trackVisit().then(() => {
      L10.trackEvent("page_view", { path: window?.location.pathname });
    });
  }
}
