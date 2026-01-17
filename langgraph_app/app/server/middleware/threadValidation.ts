import type { Context } from "hono";
import { env } from "@core";
import type { AuthContext } from "./auth";

export interface ThreadValidationResult {
  valid: boolean;
  exists: boolean;
  chat_type: string | null;
  project_id: number | null;
}

/**
 * Validates that a thread belongs to the authenticated account.
 * A thread is valid if:
 * 1. It doesn't exist yet (new thread)
 * 2. It exists and belongs to the current account
 *
 * Returns 403 if the thread exists but belongs to a different account.
 */
export async function validateThreadOwnership(
  threadId: string,
  auth: AuthContext
): Promise<ThreadValidationResult> {
  const response = await fetch(`${env.RAILS_API_URL}/api/v1/chats/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${auth.jwt}`,
    },
    body: JSON.stringify({ thread_id: threadId }),
  });

  if (response.status === 403) {
    // Thread exists but belongs to a different account
    return {
      valid: false,
      exists: true,
      chat_type: null,
      project_id: null,
    };
  }

  if (!response.ok) {
    throw new Error(`Thread validation failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ThreadValidationResult>;
}

/**
 * Middleware helper that validates thread ownership and returns an error response if invalid.
 * Use this in route handlers after extracting threadId from the request.
 *
 * @example
 * ```ts
 * const validationError = await validateThreadOrError(c, threadId, auth);
 * if (validationError) return validationError;
 * // Continue with the request...
 * ```
 */
export async function validateThreadOrError(
  c: Context,
  threadId: string,
  auth: AuthContext
): Promise<Response | null> {
  try {
    const result = await validateThreadOwnership(threadId, auth);

    if (!result.valid) {
      return c.json(
        { error: "Forbidden: Thread belongs to a different account" },
        403
      );
    }

    return null; // No error, validation passed
  } catch (error) {
    console.error("Thread validation error:", error);
    return c.json(
      { error: "Thread validation failed", details: String(error) },
      500
    );
  }
}
