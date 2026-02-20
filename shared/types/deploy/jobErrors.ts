/**
 * Shared error classification for deploy jobs.
 *
 * Rails reads this as JSON (via shared/exports/jobErrors.json).
 * Langgraph imports it directly as TypeScript.
 */

// All job types that flow through the JobRun system
export const JobNames = [
  "WebsiteDeploy",
  "CampaignDeploy",
  "CampaignEnable",
  "GoogleOAuthConnect",
  "GoogleAdsInvite",
  "GoogleAdsPaymentCheck",
] as const;
export type JobName = (typeof JobNames)[number];

// Unified error types — classify at the boundary
export const ErrorTypes = [
  "api_outage", // External API temporarily unavailable
  "rate_limit", // Rate limited by external service
  "auth_failure", // Credentials invalid/expired
  "invalid_data", // Data is wrong, won't succeed on retry
  "policy_violation", // Content rejected by policy
  "timeout", // Operation exceeded time limit
  "not_found", // Required resource doesn't exist
  "internal", // Our bug
] as const;
export type ErrorType = (typeof ErrorTypes)[number];

// Default recoverability per error type
// Philosophy: fail fast, fail loud, create support tickets.
// We'd rather hear about errors immediately than retry silently.
const ERROR_TYPE_DEFAULTS: Record<ErrorType, boolean> = {
  api_outage: false,
  rate_limit: false,
  auth_failure: false,
  invalid_data: false,
  policy_violation: false,
  timeout: false,
  not_found: false,
  internal: false,
};

// Per-job overrides (only where the default doesn't apply)
const JOB_OVERRIDES: Partial<
  Record<JobName, Partial<Record<ErrorType, boolean>>>
> = {
  // None yet — defaults cover all current cases
};

export function isRecoverable(jobName: JobName, errorType: ErrorType): boolean {
  return (
    JOB_OVERRIDES[jobName]?.[errorType] ?? ERROR_TYPE_DEFAULTS[errorType]
  );
}

/**
 * Export the full config as a JSON-serializable structure for Rails consumption.
 */
export function toJSON() {
  const defaults: Record<string, boolean> = { ...ERROR_TYPE_DEFAULTS };
  const overrides: Record<string, Record<string, boolean>> = {};

  for (const [jobName, jobOverrides] of Object.entries(JOB_OVERRIDES)) {
    if (jobOverrides) {
      overrides[jobName] = { ...jobOverrides };
    }
  }

  return {
    jobNames: [...JobNames],
    errorTypes: [...ErrorTypes],
    defaults,
    overrides,
  };
}
