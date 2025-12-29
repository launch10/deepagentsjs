/**
 * Shared E2E test configuration.
 * Single source of truth for test environment settings.
 */

export const e2eConfig = {
  /** Rails test server URL */
  railsBaseUrl: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001",

  /** Langgraph test server URL */
  langgraphBaseUrl: process.env.LANGGRAPH_TEST_URL || "http://localhost:4001",

  /** Test timeouts */
  timeouts: {
    navigation: 10000,
    response: 30000,
  },
} as const;
