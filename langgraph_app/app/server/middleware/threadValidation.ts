import type { Context } from "hono";
import { env, getLogger } from "@core";
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
 * The chat must already exist for GET (history) requests.
 *
 * Note: Brainstorm and Deploy POST routes skip this validation entirely -
 * they only require JWT auth since chats are created during graph execution
 * (via createBrainstorm / initDeploy nodes).
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
 * Used for GET (history) requests where the chat must already exist.
 * For POST (new conversations), brainstorm and deploy skip this —
 * JWT auth is sufficient since chats are created during graph execution.
 *
 * @deprecated Use validateThreadGraphOrError instead — it also checks graph type match.
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
      return c.json({ error: "Forbidden: Unauthorized" }, 403);
    }

    return null; // No error, validation passed
  } catch (error) {
    getLogger().error({ err: error }, "Thread validation error");
    return c.json({ error: "Thread validation failed", details: String(error) }, 500);
  }
}

/**
 * Validates thread ownership AND graph type match.
 * Prevents cross-graph thread contamination (e.g. deploy using a website thread).
 *
 * - New threads (exists: false): allowed — chat will be created by graph node
 * - Existing threads: chat_type must match expectedChatType
 * - Wrong account: 403 Forbidden
 * - Wrong graph: 409 Conflict
 *
 * @example
 * ```ts
 * const validationError = await validateThreadGraphOrError(c, threadId, auth, "website");
 * if (validationError) return validationError;
 * ```
 */
export async function validateThreadGraphOrError(
  c: Context,
  threadId: string,
  auth: AuthContext,
  expectedChatType: string
): Promise<Response | null> {
  try {
    const result = await validateThreadOwnership(threadId, auth);

    if (!result.valid) {
      return c.json({ error: "Forbidden: Unauthorized" }, 403);
    }

    // Thread exists but belongs to a different graph — reject
    if (result.exists && result.chat_type && result.chat_type !== expectedChatType) {
      getLogger().warn(
        { threadId, expectedChatType, actualChatType: result.chat_type },
        "Thread-graph mismatch: thread belongs to different graph"
      );
      return c.json(
        {
          error: "Conflict: Thread belongs to a different graph",
          expected: expectedChatType,
          actual: result.chat_type,
        },
        409
      );
    }

    return null; // Validation passed
  } catch (error) {
    getLogger().error({ err: error }, "Thread-graph validation error");
    return c.json({ error: "Thread validation failed", details: String(error) }, 500);
  }
}
