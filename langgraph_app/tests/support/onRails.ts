/**
 * Vitest integration with cypress-on-rails.
 *
 * Provides helper functions to execute server-side commands during vitest tests.
 * Commands are Ruby files in rails_app/e2e/app_commands/ that run in the Rails context.
 *
 * This mirrors the Playwright on-rails.ts but works from vitest.
 *
 * @example
 * // Run a scenario
 * const event = await appScenario<{ id: number }>('create_agent_context_event', {
 *   project_id: 1,
 *   event_type: 'images.created',
 *   payload: { filename: 'hero.jpg' }
 * });
 *
 * // Create records with FactoryBot
 * await appFactories([['create', 'user', { email: 'test@example.com' }]]);
 */

import { env } from "@rails_api";

const getBaseUrl = () => env.RAILS_API_URL || "http://localhost:3000";

/**
 * Execute a Rails app command via the cypress-on-rails middleware.
 * Commands are Ruby files in e2e/app_commands/.
 */
export async function appCommand<T = unknown>(name: string, options?: unknown): Promise<T> {
  const response = await fetch(`${getBaseUrl()}/__e2e__/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, options }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`App command '${name}' failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  // cypress-on-rails returns an array with the command result
  return data[0] as T;
}

/**
 * Execute a scenario command.
 * Scenarios are Ruby files in e2e/app_commands/scenarios/.
 *
 * @example
 * const event = await appScenario<{ id: number }>('create_agent_context_event', {
 *   project_id: 1,
 *   event_type: 'images.created'
 * });
 */
export async function appScenario<T = unknown>(name: string, options?: unknown): Promise<T> {
  return appCommand<T>(`scenarios/${name}`, options);
}

/**
 * Execute a query command.
 * Queries are Ruby files in e2e/app_commands/queries/.
 *
 * @example
 * const project = await appQuery<{ id: number; uuid: string }>('first_project');
 */
export async function appQuery<T = unknown>(name: string, options?: unknown): Promise<T> {
  return appCommand<T>(`queries/${name}`, options);
}

/**
 * Create records via FactoryBot.
 * Uses the factories defined in spec/factories/.
 *
 * @example
 * await appFactories([['create', 'user', { email: 'test@example.com' }]]);
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
