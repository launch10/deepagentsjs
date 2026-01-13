import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { initChatModel } from "langchain/chat_models/universal";
import { createMiddleware, type AgentMiddleware } from "langchain";

/**
 * HTTP status codes that indicate service availability issues.
 * Only these errors should trigger a model fallback.
 */
const AVAILABILITY_ERROR_CODES = new Set([
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
  529, // Overloaded (used by some providers like Anthropic)
]);

/**
 * Error messages that indicate availability issues (case-insensitive matching).
 */
const AVAILABILITY_ERROR_PATTERNS = [
  "overloaded",
  "service unavailable",
  "capacity",
  "server error",
  "internal error",
  "temporarily unavailable",
  "model is currently overloaded",
];

/**
 * Error types that should NOT trigger fallback - the request itself is bad.
 */
const NON_RECOVERABLE_ERROR_PATTERNS = [
  "invalid_api_key",
  "authentication",
  "unauthorized",
  "forbidden",
  "invalid_request",
  "context_length_exceeded",
  "max_tokens",
  "content_policy",
  "content_filter",
  "safety",
  "moderation",
];

interface ErrorWithStatus extends Error {
  status?: number;
  response?: { status?: number };
  code?: string;
  type?: string;
}

/**
 * Extracts HTTP status code from various error formats.
 */
function getErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined;

  const err = error as ErrorWithStatus;

  if (typeof err.status === "number") return err.status;
  if (typeof err.response?.status === "number") return err.response.status;

  const statusMatch = err.message.match(/\b([45]\d{2})\b/);
  if (statusMatch && statusMatch[1]) {
    return parseInt(statusMatch[1], 10);
  }

  return undefined;
}

/**
 * Determines if an error indicates a service availability issue that
 * warrants trying a fallback model.
 *
 * Returns true for:
 * - HTTP 500, 502, 503, 504, 529 errors
 * - Error messages indicating overload/capacity issues
 *
 * Returns false for:
 * - Authentication errors (401, 403)
 * - Invalid request errors (400)
 * - Rate limit errors (429) - should use backoff, not fallback
 * - Content policy violations
 * - Context length exceeded
 */
export function isAvailabilityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const status = getErrorStatus(error);
  if (status !== undefined) {
    // Rate limits (429) should NOT trigger fallback - use backoff instead
    if (status === 429) {
      // Exception: some "429" errors are really capacity issues
      const message = error.message.toLowerCase();
      return AVAILABILITY_ERROR_PATTERNS.some((p) => message.includes(p));
    }

    if (AVAILABILITY_ERROR_CODES.has(status)) return true;

    // 4xx errors are client errors - don't fallback
    if (status >= 400 && status < 500) return false;
  }

  const message = error.message.toLowerCase();
  const errorType = ((error as ErrorWithStatus).type || "").toLowerCase();
  const errorCode = ((error as ErrorWithStatus).code || "").toLowerCase();

  // Check for non-recoverable patterns first
  const isNonRecoverable = NON_RECOVERABLE_ERROR_PATTERNS.some(
    (p) => message.includes(p) || errorType.includes(p) || errorCode.includes(p)
  );
  if (isNonRecoverable) return false;

  // Check for availability patterns
  return AVAILABILITY_ERROR_PATTERNS.some((p) => message.includes(p));
}

/**
 * Middleware that provides automatic model fallback ONLY for availability errors.
 *
 * Unlike the standard modelFallbackMiddleware that retries on ANY error, this
 * middleware only falls back when a model is genuinely unavailable (503, 529,
 * overloaded, etc).
 *
 * Errors that will NOT trigger fallback:
 * - Authentication errors (401, 403) - different model won't help
 * - Invalid request errors (400) - the request is malformed
 * - Rate limit errors (429) - should use retry with backoff instead
 * - Content policy violations - other models will likely block too
 * - Context length exceeded - smaller model might be worse
 *
 * @example
 * ```ts
 * import { unavailableModelFallbackMiddleware } from "@core";
 *
 * const fallback = unavailableModelFallbackMiddleware(
 *   "openai:gpt-4o-mini",      // First fallback
 *   "anthropic:claude-sonnet-4-5-20250929",  // Second fallback
 * );
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",    // Primary model
 *   middleware: [fallback],
 *   tools: [],
 * });
 * ```
 *
 * @param fallbackModels - The fallback models to try, in order.
 * @returns A middleware instance that handles model unavailability with fallbacks
 */
export function unavailableModelFallbackMiddleware(
  ...fallbackModels: (string | LanguageModelLike)[]
): AgentMiddleware {
  return createMiddleware({
    name: "unavailableModelFallbackMiddleware",
    wrapModelCall: async (request, handler) => {
      // Try the primary model first
      try {
        return await handler(request);
      } catch (error) {
        // Only fallback for availability errors
        if (!isAvailabilityError(error)) {
          throw error;
        }

        // Try fallback models in sequence
        for (let i = 0; i < fallbackModels.length; i++) {
          try {
            const fallbackModel = fallbackModels[i]!;
            const model =
              typeof fallbackModel === "string"
                ? await initChatModel(fallbackModel)
                : fallbackModel;

            return await handler({
              ...request,
              model,
            });
          } catch (fallbackError) {
            // Only continue to next fallback if this is also an availability error
            if (!isAvailabilityError(fallbackError)) {
              throw fallbackError;
            }

            // If this is the last fallback, throw the error
            if (i === fallbackModels.length - 1) {
              throw fallbackError;
            }
            // Otherwise, continue to next fallback
          }
        }

        // If no fallbacks were provided, re-throw the original error
        throw error;
      }
    },
  });
}
