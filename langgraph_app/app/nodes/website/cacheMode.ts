import { env } from "@core";

export const CACHE_MODE = env.CACHE_MODE === true;

/**
 * Cache mode only applies to the create flow (no existing messages).
 * After creation, edits go through the real system so we can test e2e.
 */
export const isCacheModeEnabled = (state?: { messages?: unknown[] }): boolean => {
  if (!CACHE_MODE) return false;
  // If state is provided, only cache on create (first message)
  if (state && state.messages && state.messages.length > 0) return false;
  return true;
};
