/**
 * Tracking utilities for E2E tests.
 * Used to verify tracking data landed in the database.
 *
 * The test page uses the REAL tracking.ts + Buildable pipeline:
 * - Real tracking.ts from templates/default
 * - Real Vite build with env var injection
 * - Real gtag script injection via Buildable concern
 *
 * Call `buildTestPage()` in a beforeAll hook before running tests.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { e2eConfig } from "../config";
import { logger } from "../utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RAILS_ROOT = path.join(__dirname, "../..");
const DIST_PATH = path.join(RAILS_ROOT, "tmp/tracking-test-dist");
const PROJECT_ID_FILE = path.join(DIST_PATH, ".project-id");

const BASE_URL = e2eConfig.railsBaseUrl;

export interface TrackingEvent {
  name: string;
  properties: Record<string, unknown>;
  time: string;
}

export interface TrackingStats {
  visit_count: number;
  visitor_tokens: string[];
  events: TrackingEvent[];
}

export interface LeadInfo {
  email: string;
  name: string | null;
  gclid: string | null;
  visitor_token: string | null;
  visit_token: string | null;
  created_at: string;
}

export interface ConversionInfo {
  value: number | null;
  currency: string | null;
  email: string | null;
  time: string | null;
}

export interface LeadStats {
  lead_count: number;
  leads: LeadInfo[];
  conversions: ConversionInfo[];
}

/**
 * Service for interacting with the Rails Test Tracking API.
 * Used to verify that tracking calls result in database records.
 *
 * @example
 * const stats = await TrackingHelper.getStats(websiteId);
 * expect(stats.visit_count).toBe(1);
 * expect(stats.events).toContainEqual(expect.objectContaining({ name: "page_view" }));
 */
export const TrackingHelper = {
  /**
   * Gets tracking statistics for a website.
   * Returns visit count, unique visitor tokens, and all events.
   * @param websiteId - The ID of the website to get stats for
   */
  async getStats(websiteId: string | number): Promise<TrackingStats> {
    const response = await fetch(
      `${BASE_URL}/test/tracking/stats?website_id=${websiteId}`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to get tracking stats for website ${websiteId}: ${response.status} - ${error}`
      );
    }

    return response.json();
  },

  /**
   * Waits for a specific number of visits to be recorded.
   * Useful when tracking calls are asynchronous.
   * @param websiteId - The ID of the website
   * @param expectedCount - The expected number of visits
   * @param timeoutMs - Maximum time to wait (default 5000ms)
   * @param intervalMs - Polling interval (default 200ms)
   */
  async waitForVisits(
    websiteId: string | number,
    expectedCount: number,
    timeoutMs: number = 5000,
    intervalMs: number = 200
  ): Promise<TrackingStats> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const stats = await this.getStats(websiteId);
      if (stats.visit_count >= expectedCount) {
        return stats;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(
      `Timeout waiting for ${expectedCount} visits for website ${websiteId}`
    );
  },

  /**
   * Waits for a specific event to be recorded.
   * @param websiteId - The ID of the website
   * @param eventName - The name of the event to wait for
   * @param timeoutMs - Maximum time to wait (default 5000ms)
   * @param intervalMs - Polling interval (default 200ms)
   */
  async waitForEvent(
    websiteId: string | number,
    eventName: string,
    timeoutMs: number = 5000,
    intervalMs: number = 200
  ): Promise<TrackingEvent> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const stats = await this.getStats(websiteId);
      const event = stats.events.find((e) => e.name === eventName);
      if (event) {
        return event;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(
      `Timeout waiting for event "${eventName}" for website ${websiteId}`
    );
  },

  /**
   * Gets lead and conversion data for a website.
   * @param websiteId - The ID of the website to get leads for
   */
  async getLeads(websiteId: string | number): Promise<LeadStats> {
    const response = await fetch(
      `${BASE_URL}/test/tracking/leads?website_id=${websiteId}`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to get lead stats for website ${websiteId}: ${response.status} - ${error}`
      );
    }

    return response.json();
  },

  /**
   * Waits for a lead to be recorded with the given email.
   * @param websiteId - The ID of the website
   * @param email - The email to wait for
   * @param timeoutMs - Maximum time to wait (default 5000ms)
   * @param intervalMs - Polling interval (default 200ms)
   */
  async waitForLead(
    websiteId: string | number,
    email: string,
    timeoutMs: number = 5000,
    intervalMs: number = 200
  ): Promise<LeadInfo> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const stats = await this.getLeads(websiteId);
      const lead = stats.leads.find((l) => l.email === email.toLowerCase());
      if (lead) {
        return lead;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(
      `Timeout waiting for lead "${email}" for website ${websiteId}`
    );
  },

  /**
   * Waits for a conversion event with the given email.
   * @param websiteId - The ID of the website
   * @param email - The email to match in the conversion
   * @param timeoutMs - Maximum time to wait (default 5000ms)
   * @param intervalMs - Polling interval (default 200ms)
   */
  async waitForConversion(
    websiteId: string | number,
    email: string,
    timeoutMs: number = 5000,
    intervalMs: number = 200
  ): Promise<ConversionInfo> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const stats = await this.getLeads(websiteId);
      const conversion = stats.conversions.find(
        (c) => c.email === email.toLowerCase()
      );
      if (conversion) {
        return conversion;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(
      `Timeout waiting for conversion for "${email}" for website ${websiteId}`
    );
  },

  /**
   * Gets the URL for the REAL built tracking page.
   * This page was built using the real Buildable pipeline with:
   * - Real tracking.ts from templates/default
   * - Real Vite build
   * - Real gtag injection
   *
   * The project/website for this page is created by TrackingTestBuilder
   * and available via getBuiltPageInfo()
   */
  getTestPageUrl(): string {
    return `${BASE_URL}/test/tracking/built`;
  },

  /**
   * Gets info about the built tracking test project/website.
   * This is created by TrackingTestBuilder during Playwright globalSetup.
   */
  async getTestPageInfo(): Promise<{ projectId: number; websiteId: number }> {
    const response = await fetch(`${BASE_URL}/test/tracking/info`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get built page info: ${response.status} - ${await response.text()}`
      );
    }

    return response.json();
  },

  indexHtmlPath(): string {
    return path.join(DIST_PATH, "index.html");
  },

  buildExists(): boolean {
    return fs.existsSync(this.indexHtmlPath());
  },

  async cleanup(): Promise<void> {
    if (this.buildExists()) {
      logger.info(
        "[TrackingHelper] Build exists but database records mismatched, rebuilding..."
      );
      execSync("bundle exec rake test:tracking:clean", {
        cwd: RAILS_ROOT,
        stdio: "inherit",
        env: { ...process.env, RAILS_ENV: "test" },
      });
    }
  },

  /**
   * Ensures the tracking test build exists and database records match.
   * Call this in a beforeAll hook before running tracking tests.
   *
   * The build bakes in the project's signup_token (a signed_id).
   * If the database is restored/reset, the project ID changes and the token becomes invalid.
   * This method verifies BOTH the build exists AND the database records match.
   */
  async buildTestPage(): Promise<void> {
    const doesBuildExist = this.buildExists();
    let dbRecordsMatch = false;

    if (doesBuildExist && fs.existsSync(PROJECT_ID_FILE)) {
      const buildProjectId = fs.readFileSync(PROJECT_ID_FILE, "utf-8").trim();
      dbRecordsMatch = await this.verifyDatabaseRecords(buildProjectId);
    }

    if (doesBuildExist && dbRecordsMatch) {
      logger.info(
        "[TrackingHelper] Build and database records valid, skipping rebuild."
      );
      return;
    }

    if (doesBuildExist && !dbRecordsMatch) {
      await this.cleanup();
    }

    logger.info(
      "[TrackingHelper] Building tracking-test website using real Buildable pipeline..."
    );

    try {
      execSync("bundle exec rake test:tracking:build", {
        cwd: RAILS_ROOT,
        stdio: "inherit",
        env: { ...process.env, RAILS_ENV: "test" },
      });
      logger.info("[TrackingHelper] Tracking test build complete.");
    } catch (error) {
      logger.error("[TrackingHelper] Failed to build tracking-test website:", error);
      throw error;
    }
  },

  /**
   * Verify that the tracking test database records exist and match the build.
   * @internal
   */
  async verifyDatabaseRecords(expectedProjectId: string): Promise<boolean> {
    try {
      const response = await fetch(`${BASE_URL}/test/tracking/info`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        logger.info("[TrackingHelper] Could not fetch tracking info");
        return false;
      }

      const data = await response.json();
      const currentProjectId = String(data.projectId);

      if (currentProjectId === expectedProjectId) {
        logger.info(`[TrackingHelper] Database project ID ${currentProjectId} matches build`);
        return true;
      } else {
        logger.info(
          `[TrackingHelper] Database project ID ${currentProjectId} doesn't match build (${expectedProjectId})`
        );
        return false;
      }
    } catch (error) {
      logger.info("[TrackingHelper] Could not verify database records:", error);
      return false;
    }
  },
};
