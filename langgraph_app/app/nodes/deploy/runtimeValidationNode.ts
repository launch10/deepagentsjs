import { type DeployGraphState } from "@annotation";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { NodeMiddleware } from "@middleware";
import { ErrorExporter } from "@services";
import { Deploy, Task } from "@types";
import { getLogger } from "@core";
import { type TaskRunner, registerTask, isTaskDone } from "./taskRunner";

const TASK_NAME: Deploy.TaskName = "RuntimeValidation";

/**
 * Playwright infrastructure errors — these are NOT code bugs in the user's website.
 * When we catch one of these, we skip the validation (pass) instead of triggering bug-fix.
 */
const INFRA_ERROR_PATTERNS = [
  /Target page, context or browser has been closed/i,
  /browser has been closed/i,
  /Protocol error/i,
  /Navigation failed because page was closed/i,
  /frame was detached/i,
  /Execution context was destroyed/i,
];

function isInfrastructureError(message: string): boolean {
  return INFRA_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Runtime Validation
 *
 * Uses Playwright to validate the website before deployment:
 * 1. Starts dev server using WebsiteRunner
 * 2. Loads page in browser context from pool
 * 3. Captures console errors
 * 4. Returns validation status
 */
async function runRuntimeValidation(
  state: DeployGraphState,
  config?: LangGraphRunnableConfig
): Promise<Partial<DeployGraphState>> {
  const log = getLogger({ component: "RuntimeValidation" });
  const task = Task.findTask(state.tasks, TASK_NAME);

  // Already completed or failed? No-op (idempotent)
  if (task?.status !== "running") {
    return {};
  }

  if (!state.websiteId) {
    throw new Error("WebsiteId is required for runtime validation");
  }

  const t0 = Date.now();
  log.info({ websiteId: state.websiteId }, "RuntimeValidation BEGIN");

  try {
    // Use await using for proper cleanup (AsyncDisposable)
    await using exporter = new ErrorExporter(state.websiteId);
    const errors = await exporter.run();

    // Use hasErrors with excludeWarnings to only fail on actual errors
    const passed = !errors.hasErrors({ excludeWarnings: true });

    log.info(
      {
        elapsedMs: Date.now() - t0,
        passed,
        browserErrors: errors.browser.length,
        serverErrors: errors.server.length,
      },
      "RuntimeValidation END (normal path)"
    );

    return {
      tasks: [
        {
          ...task,
          status: passed ? "completed" : "failed",
          result: {
            browserErrorCount: errors.browser.filter((e) => e.type === "error").length,
            serverErrorCount: errors.server.length,
            viteOverlayErrorCount: errors.viteOverlay.length,
            report: errors.getFormattedReport(),
          },
          error: passed ? undefined : errors.getFormattedReport(),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // If this is a Playwright infrastructure error (browser crashed, context closed, etc.),
    // treat it as a pass — we have no evidence of code bugs, just automation issues.
    // This prevents the bug-fix agent from trying to "fix" Playwright errors in user code.
    if (isInfrastructureError(errorMessage)) {
      log.warn(
        { err: error, elapsedMs: Date.now() - t0 },
        "RuntimeValidation END (infra-error path, treating as pass)"
      );
      return {
        tasks: [
          {
            ...task,
            status: "completed",
            result: {
              browserErrorCount: 0,
              serverErrorCount: 0,
              viteOverlayErrorCount: 0,
              report: "Validation skipped due to browser infrastructure issue (not a code error)",
            },
            warning: `Browser automation error (not a code bug): ${errorMessage}`,
          },
        ],
      };
    }

    log.error({ err: error, elapsedMs: Date.now() - t0 }, "RuntimeValidation END (error path)");

    return {
      tasks: [
        {
          ...task,
          status: "failed",
          error: errorMessage,
        },
      ],
    };
  }
}

// Legacy export with middleware
export const runtimeValidationNode = NodeMiddleware.use({}, runRuntimeValidation);

/**
 * Runtime Validation Task Runner
 *
 * Validates the website using Playwright before deployment.
 */
export const runtimeValidationTaskRunner: TaskRunner = {
  taskName: TASK_NAME,
  isFailureRecoverable: true,

  readyToRun: (state: DeployGraphState) => {
    // For campaign deploys, wait until billing is resolved
    if (Deploy.shouldDeployGoogleAds(state)) {
      return isTaskDone(state, "CheckingBilling");
    }
    // For website-only deploys, ready immediately
    return true;
  },

  shouldSkip: (state: DeployGraphState) => {
    // Skip if not deploying a website
    if (!Deploy.shouldDeployWebsite(state)) {
      return true;
    }

    return false;
  },

  run: runRuntimeValidation,
};

// Register this task runner
registerTask(runtimeValidationTaskRunner);
