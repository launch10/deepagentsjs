import type { Context } from "hono";
import { env } from "@core";
import { ChatsAPIService } from "@rails_api";
import type { AuthContext } from "./auth";

export interface ThreadValidationResult {
  valid: boolean;
  exists: boolean;
  chat_type: string | null;
  project_id: number | null;
}

/**
 * Validates that a thread belongs to the authenticated account.
 * The chat must already exist (pre-created via ChatCreatable).
 *
 * Note: Brainstorm POST route skips this validation entirely - it only
 * requires JWT auth since new threads are created during graph execution.
 */
export async function validateThreadOwnership(
  threadId: string,
  auth: AuthContext
): Promise<ThreadValidationResult> {
  const chatsService = new ChatsAPIService({
    jwt: auth.jwt,
    baseUrl: env.RAILS_API_URL,
  });

  try {
    const result = await chatsService.validate({ thread_id: threadId });
    return {
      valid: result.valid,
      exists: result.exists,
      chat_type: result.chat_type ?? null,
      project_id: result.project_id ?? null,
    };
  } catch (error) {
    // Check if it's a 403 error (thread doesn't exist or belongs to different account)
    if (error instanceof Error && error.message.includes("403")) {
      return {
        valid: false,
        exists: false,
        chat_type: null,
        project_id: null,
      };
    }
    throw error;
  }
}

/**
 * Middleware helper that validates thread ownership and returns an error response if invalid.
 * Use this in route handlers after extracting threadId from the request.
 *
 * The chat must already exist (pre-created via ChatCreatable callback).
 * For brainstorm POST (new conversations), skip this validation - JWT auth is sufficient.
 *
 * @example
 * ```ts
 * const validationError = await validateThreadOrError(c, threadId, auth);
 * if (validationError) return validationError;
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
        { error: "Forbidden: Unauthorized" },
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
