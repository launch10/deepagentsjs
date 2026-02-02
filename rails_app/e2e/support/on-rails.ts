/**
 * Playwright integration with cypress-on-rails.
 *
 * Provides helper functions to execute server-side commands during e2e tests.
 * Commands are Ruby files in e2e/app_commands/ that run in the Rails context.
 *
 * @example
 * // Clean the database
 * await clean();
 *
 * // Run a scenario
 * const { user_id } = await appScenario<{ user_id: number }>('basic');
 *
 * // Create records with FactoryBot
 * await appFactories([['create', 'user', { email: 'test@example.com' }]]);
 *
 * // Time travel
 * await timecop.freeze('2024-01-01');
 */

import { e2eConfig } from "../config";

const BASE_URL = e2eConfig.railsBaseUrl;

/**
 * Execute a Rails app command via the cypress-on-rails middleware.
 * Commands are Ruby files in e2e/app_commands/.
 */
export async function appCommand<T = unknown>(
  name: string,
  options?: unknown
): Promise<T> {
  const response = await fetch(`${BASE_URL}/__e2e__/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, options }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `App command '${name}' failed: ${response.status} - ${error}`
    );
  }

  const data = await response.json();
  // cypress-on-rails returns an array with the command result
  return data[0] as T;
}

/**
 * Shorthand for appCommand - matches cypress-on-rails convention.
 */
export const app = appCommand;

/**
 * Execute a scenario command.
 * Scenarios are Ruby files in e2e/app_commands/scenarios/.
 *
 * @example
 * const { email } = await appScenario<{ email: string }>('basic');
 * await appScenario('fill_subdomain_limit', { email });
 */
export async function appScenario<T = unknown>(
  name: string,
  options?: unknown
): Promise<T> {
  return appCommand<T>(`scenarios/${name}`, options);
}

/**
 * Execute a query command.
 * Queries are Ruby files in e2e/app_commands/queries/.
 *
 * @example
 * const project = await appQuery<{ id: number; uuid: string }>('first_project');
 * const website = await appQuery<{ id: number; name: string }>('first_website');
 */
export async function appQuery<T = unknown>(
  name: string,
  options?: unknown
): Promise<T> {
  return appCommand<T>(`queries/${name}`, options);
}

/**
 * Create records via FactoryBot.
 * Uses the factories defined in spec/factories/.
 *
 * @example
 * // Create a single user
 * await appFactories([['create', 'user', { email: 'test@example.com' }]]);
 *
 * // Create multiple records
 * await appFactories([
 *   ['create', 'user', { email: 'test@example.com' }],
 *   ['create', 'website', { name: 'My Site' }],
 * ]);
 *
 * // Create with associations
 * await appFactories([['create', 'user', ':with_website']]);
 */
export async function appFactories<T = unknown>(
  factories: Array<[string, string, ...unknown[]]>
): Promise<T> {
  return appCommand<T>("factory_bot", factories);
}

/**
 * Evaluate arbitrary Ruby code.
 * Use sparingly - prefer scenarios or factories.
 *
 * @example
 * const count = await appEval<number>('User.count');
 */
export async function appEval<T = unknown>(code: string): Promise<T> {
  return appCommand<T>("eval", code);
}

/**
 * Clean the database (truncation).
 * Run this in beforeEach to ensure clean state.
 */
export async function clean(): Promise<void> {
  await appCommand("clean");
}

/**
 * Time manipulation via Timecop.
 *
 * @example
 * // Freeze time
 * await timecop.freeze('2024-01-01 12:00:00');
 *
 * // Travel to a time (clock keeps moving)
 * await timecop.travel('2024-01-01');
 *
 * // Return to real time
 * await timecop.return();
 */
export const timecop = {
  /**
   * Freeze time at a specific moment.
   * Time will not advance until timecop.return() is called.
   */
  freeze: (time: string) => appCommand("timecop", { freeze: time }),

  /**
   * Travel to a specific time.
   * Time will continue to advance from that point.
   */
  travel: (time: string) => appCommand("timecop", { travel: time }),

  /**
   * Return to real time.
   */
  return: () => appCommand("timecop", { return: true }),
};
