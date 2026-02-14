/**
 * Deploy Error Mapping
 *
 * Maps raw error messages from Sidekiq/Langgraph to user-friendly messages.
 * Used by the frontend DeployErrorScreen to show clear, actionable errors.
 */

export interface DeployError {
  title: string;
  message: string;
  canRetry: boolean;
}

/**
 * Error patterns mapped to user-friendly messages.
 * Patterns are matched against the raw error string (case-insensitive).
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; error: DeployError }> = [
  {
    pattern: /timed out/i,
    error: {
      title: "Deployment timed out",
      message: "The deployment took longer than expected. This usually resolves on retry.",
      canRetry: true,
    },
  },
  // More specific patterns before generic "deploy.*failed"
  {
    pattern: /website deploy.*failed/i,
    error: {
      title: "Website deployment failed",
      message: "We couldn't deploy your website. Please try again.",
      canRetry: true,
    },
  },
  {
    pattern: /campaign.*failed/i,
    error: {
      title: "Campaign deployment failed",
      message: "We couldn't sync your ad campaign. Please try again.",
      canRetry: true,
    },
  },
  {
    pattern: /deploy.*failed/i,
    error: {
      title: "Deployment failed",
      message: "Something went wrong during deployment. Please try again.",
      canRetry: true,
    },
  },
  {
    pattern: /sidekiq retries exhausted/i,
    error: {
      title: "Deployment failed after multiple attempts",
      message: "We tried several times but couldn't complete the deployment. Please try again in a few minutes.",
      canRetry: true,
    },
  },
  {
    pattern: /google.*oauth|oauth.*google/i,
    error: {
      title: "Google connection issue",
      message: "There was a problem connecting to your Google account. Please try reconnecting.",
      canRetry: true,
    },
  },
  {
    pattern: /payment|billing/i,
    error: {
      title: "Payment issue",
      message: "There was a problem verifying your payment method. Please check your billing settings.",
      canRetry: true,
    },
  },
  {
    pattern: /rate.?limit|too many requests|429/i,
    error: {
      title: "Too many requests",
      message: "We're being rate limited. Please wait a moment and try again.",
      canRetry: true,
    },
  },
  {
    pattern: /network|connection|ECONNREFUSED|ETIMEDOUT/i,
    error: {
      title: "Connection issue",
      message: "We're having trouble connecting to our services. Please try again in a moment.",
      canRetry: true,
    },
  },
];

const DEFAULT_ERROR: DeployError = {
  title: "Deployment failed",
  message: "Something unexpected went wrong. Please try again.",
  canRetry: true,
};

/**
 * Map a raw error message to a user-friendly DeployError.
 *
 * @param rawError - The raw error string from the backend
 * @returns A user-friendly DeployError object
 */
export function getDeployError(rawError?: string | null): DeployError {
  if (!rawError) return DEFAULT_ERROR;

  for (const { pattern, error } of ERROR_PATTERNS) {
    if (pattern.test(rawError)) {
      return error;
    }
  }

  return DEFAULT_ERROR;
}
