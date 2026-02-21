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

// --- Attribution storage (localStorage with 30-day TTL) ---

const CLICK_ID_STORAGE_KEY = "l10_click_ids";
const CLICK_ID_TS_KEY = "l10_click_ids_ts";
const CLICK_ID_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type ClickIds = { gclid?: string; fbclid?: string };

// Helper to get URL parameters
function getParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Capture gclid/fbclid from the URL and persist in localStorage (30-day TTL).
 * Always overwrites when new click IDs are in the URL — each ad click is its own
 * attribution event. localStorage is only a cross-session fallback for when a
 * visitor returns without click IDs in the URL (e.g., day 1 ad click → day 2 conversion).
 * Server-side Ahoy visits preserve the full multi-touch history independently.
 */
function captureClickIds(): void {
  if (typeof window === "undefined") return;

  const gclid = getParam("gclid");
  const fbclid = getParam("fbclid");

  if (gclid || fbclid) {
    const ids: ClickIds = {};
    if (gclid) ids.gclid = gclid;
    if (fbclid) ids.fbclid = fbclid;
    window.localStorage?.setItem(CLICK_ID_STORAGE_KEY, JSON.stringify(ids));
    window.localStorage?.setItem(CLICK_ID_TS_KEY, String(Date.now()));
  }
}

/**
 * Retrieve stored click IDs, or empty object if none or expired.
 */
function getClickIds(): ClickIds {
  if (typeof window === "undefined") return {};

  const stored = window.localStorage?.getItem(CLICK_ID_STORAGE_KEY);
  const storedTs = window.localStorage?.getItem(CLICK_ID_TS_KEY);

  if (!stored || !storedTs) return {};

  const age = Date.now() - Number(storedTs);
  if (age >= CLICK_ID_TTL_MS) {
    window.localStorage?.removeItem(CLICK_ID_STORAGE_KEY);
    window.localStorage?.removeItem(CLICK_ID_TS_KEY);
    return {};
  }

  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Get gclid — prefer URL (current ad click) over localStorage (cross-session fallback).
 */
function getGclid(): string | null {
  return getParam("gclid") || getClickIds().gclid || null;
}

/**
 * Get fbclid — prefer URL (current ad click) over localStorage (cross-session fallback).
 */
function getFbclid(): string | null {
  return getParam("fbclid") || getClickIds().fbclid || null;
}

// Capture click IDs on module load
captureClickIds();

// Deduplication state for createLead (guards against onClick + onSubmit double-fire)
let _lastLeadCall = { email: "", ts: 0 };

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
          fbclid: getFbclid(),
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
    options?: { value?: number; currency?: string; name?: string; phone?: string }
  ): Promise<void> {
    const now = Date.now();
    if (email === _lastLeadCall.email && now - _lastLeadCall.ts < 500) {
      return; // Deduplicate rapid double-fire (e.g. onClick + onSubmit)
    }
    _lastLeadCall = { email, ts: now };

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
          phone: options?.phone,
          token: signupToken,
          visitor_token: this.getVisitorToken(),
          visit_token: this.getVisitToken(),
          gclid: getGclid(),
          fbclid: getFbclid(),
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

// Auto-track visit and page view on load (window-level guard survives chunk duplication)
const INIT_KEY = "__l10_tracking_initialized__";

if (typeof window !== "undefined" && typeof document !== "undefined" && !(window as any)[INIT_KEY]) {
  (window as any)[INIT_KEY] = true;
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
