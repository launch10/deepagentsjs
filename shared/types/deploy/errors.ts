/**
 * Deploy Error Classification
 *
 * Uses error.node (task name) as the primary classification signal,
 * with cross-cutting patterns (timeout, network, rate limit) checked first.
 *
 * Each node has a default error message for when the raw error doesn't match
 * any expected pattern. Unknown errors fall through to a generic message.
 */

import type { TaskName } from "./tasks";

export interface DeployError {
  title: string;
  message: string;
  canRetry: boolean;
  needsSupport: boolean;
}

/**
 * Cross-cutting error patterns.
 *
 * These apply regardless of which node failed. Checked first because
 * a timeout or network error has the same user-facing meaning everywhere.
 */
const CROSS_CUTTING_PATTERNS: Array<{ pattern: RegExp; error: DeployError }> = [
  {
    pattern: /timed out/i,
    error: {
      title: "Deployment timed out",
      message: "The deployment took longer than expected. This usually resolves on retry.",
      canRetry: true,
      needsSupport: false,
    },
  },
  {
    pattern: /rate.?limit|too many requests|429/i,
    error: {
      title: "Too many requests",
      message: "We're being rate limited. Please wait a moment and try again.",
      canRetry: true,
      needsSupport: false,
    },
  },
  {
    pattern: /network|ECONNREFUSED|ETIMEDOUT/i,
    error: {
      title: "Connection issue",
      message: "We're having trouble connecting to our services. Please try again in a moment.",
      canRetry: true,
      needsSupport: false,
    },
  },
  {
    pattern: /sidekiq retries exhausted/i,
    error: {
      title: "Deployment failed after multiple attempts",
      message: "We tried several times but couldn't complete the deployment. Please try again in a few minutes.",
      canRetry: true,
      needsSupport: true,
    },
  },
];

/**
 * Per-node default errors.
 *
 * When we know which node failed but the raw error doesn't match any
 * cross-cutting pattern, use the node's default error. This prevents
 * misclassification from regex matching raw HTML stack traces.
 */
const NODE_ERRORS: Partial<Record<TaskName | "taskExecutor" | "unknown", DeployError>> = {
  // Google setup
  ConnectingGoogle: {
    title: "Google connection issue",
    message: "There was a problem connecting to your Google account. Please try reconnecting.",
    canRetry: true,
    needsSupport: false,
  },
  VerifyingGoogle: {
    title: "Google verification issue",
    message: "There was a problem verifying your Google account. Please try again.",
    canRetry: true,
    needsSupport: false,
  },

  // Billing
  CheckingBilling: {
    title: "Payment issue",
    message: "There was a problem verifying your payment method. Please check your billing settings.",
    canRetry: true,
    needsSupport: false,
  },

  // Validation
  ValidateLinks: {
    title: "Link validation failed",
    message: "We found issues while checking your website links. Please try again.",
    canRetry: true,
    needsSupport: false,
  },
  RuntimeValidation: {
    title: "Validation failed",
    message: "We found issues while checking your website. Please try again.",
    canRetry: true,
    needsSupport: false,
  },
  FixingBugs: {
    title: "Bug fix failed",
    message: "We couldn't automatically fix the issues found. Please try again.",
    canRetry: true,
    needsSupport: true,
  },

  // Website preparation
  OptimizingSEO: {
    title: "SEO optimization failed",
    message: "We couldn't optimize your website's SEO. Please try again.",
    canRetry: true,
    needsSupport: false,
  },
  AddingAnalytics: {
    title: "Analytics setup failed",
    message: "We couldn't add analytics to your website. Please try again.",
    canRetry: true,
    needsSupport: false,
  },

  // Deploy
  DeployingWebsite: {
    title: "Website deployment failed",
    message: "We couldn't deploy your website. Please try again.",
    canRetry: true,
    needsSupport: true,
  },

  // Campaign
  DeployingCampaign: {
    title: "Campaign deployment failed",
    message: "We couldn't sync your ad campaign. Please try again.",
    canRetry: true,
    needsSupport: true,
  },
  EnablingCampaign: {
    title: "Campaign activation failed",
    message: "We couldn't enable your ad campaign. Please try again.",
    canRetry: true,
    needsSupport: true,
  },
};

const DEFAULT_ERROR: DeployError = {
  title: "Deployment failed",
  message: "Something unexpected went wrong. Please try again.",
  canRetry: true,
  needsSupport: true,
};

/**
 * Map a raw error to a user-friendly DeployError.
 *
 * Classification priority:
 * 1. Cross-cutting patterns (timeout, rate limit, network) — apply to any node
 * 2. Node-specific default — when we know which node failed
 * 3. Generic fallback — when node is unknown or not provided
 *
 * @param rawError - The raw error string from the backend
 * @param node - The task/node name that failed (e.g. "DeployingWebsite")
 */
export function getDeployError(rawError?: string | null, node?: string | null): DeployError {
  if (!rawError && !node) return DEFAULT_ERROR;

  // 1. Cross-cutting patterns always win (timeout, network, etc.)
  if (rawError) {
    for (const { pattern, error } of CROSS_CUTTING_PATTERNS) {
      if (pattern.test(rawError)) {
        return error;
      }
    }
  }

  // 2. Node-specific default — the node knows what kind of failure this is
  if (node) {
    const nodeError = NODE_ERRORS[node as TaskName | "taskExecutor" | "unknown"];
    if (nodeError) {
      return nodeError;
    }
  }

  // 3. Generic fallback
  return DEFAULT_ERROR;
}

/**
 * Check if a raw error message indicates a failure that needs a support ticket.
 */
export function needsSupportTicket(rawError?: string | null, node?: string | null): boolean {
  return getDeployError(rawError, node).needsSupport;
}
