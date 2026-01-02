/**
 * Shared E2E test configuration.
 * Single source of truth for test environment settings.
 */

export const e2eConfig = {
  /** Rails test server URL */
  railsBaseUrl: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001",

  /** Langgraph test server URL */
  langgraphBaseUrl: process.env.LANGGRAPH_TEST_URL || "http://localhost:4001",

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
