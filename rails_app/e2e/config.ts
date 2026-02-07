/**
 * Shared E2E test configuration.
 * Single source of truth for test environment settings.
 *
 * Port detection: reads RAILS_PORT / LANGGRAPH_PORT env vars set by
 * config/services.sh so clones (launch1-launch4) use the correct ports.
 */

const railsPort = process.env.RAILS_PORT || "3001";
const langgraphPort = process.env.LANGGRAPH_PORT || "4001";

export const e2eConfig = {
  /** Rails test server URL */
  railsBaseUrl: process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${railsPort}`,

  /** Langgraph test server URL */
  langgraphBaseUrl: process.env.LANGGRAPH_TEST_URL || `http://localhost:${langgraphPort}`,

  /** Test timeouts (in ms) - keep short to fail fast */
  timeouts: {
    /** Page navigation timeout */
    navigation: 15000,
    /** Default waitForResponse timeout */
    response: 15000,
    /** AI response timeout (longer for LLM calls) */
    aiResponse: 30000,
    /** Short timeout for quick checks */
    short: 5000,
  },
} as const;
