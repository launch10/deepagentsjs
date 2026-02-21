import type { Route } from "@playwright/test";

/**
 * Shared SSE mock utilities for deploy stream tests.
 *
 * The langgraph-ai-sdk-react SDK uses `parseJsonEventStream` which expects
 * standard Server-Sent Events format. Each state key becomes a `data-state-{key}`
 * event that the SDK's StateManager processes via `processStatePart()`.
 */

export interface DeployTaskResult {
  action?: string;
  has_payment?: boolean;
  google_email?: string;
  status?: string;
  [key: string]: unknown;
}

export interface DeployTask {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  warning?: string;
  error?: string;
  result?: DeployTaskResult;
}

export interface DeployState {
  status: "pending" | "running" | "completed" | "failed";
  instructions?: Record<string, boolean>;
  tasks?: DeployTask[];
  error?: { message: string; node?: string };
  supportTicket?: string;
  nothingChanged?: boolean;
  [key: string]: unknown;
}

/**
 * Build an SSE body from a graph state object.
 *
 * Format per event: `data: {"type":"data-state-{key}","id":"{n}","data":<value>}\n\n`
 *
 * IMPORTANT: `status` is always emitted LAST. When the deploy page has no
 * existing deploy (no GET history — only SSE POST), events are processed
 * sequentially. If `status: "completed"` arrives before `tasks`, the
 * DeployCompleteScreen mounts with `tasks = undefined` and renders the
 * wrong heading. By emitting `status` last, all other state keys (tasks,
 * error, supportTicket, etc.) are already in the store when the screen-
 * determining status change triggers React rendering.
 */
export function buildSSE(state: Record<string, unknown>): string {
  let id = 0;
  // Emit `status` last — it determines which screen renders, so all other
  // state keys must already be set when it arrives.
  const entries = Object.entries(state).sort(([a], [b]) => {
    if (a === "status") return 1;
    if (b === "status") return -1;
    return 0;
  });
  return entries
    .map(([key, value]) => {
      id++;
      return `data: ${JSON.stringify({ type: `data-state-${key}`, id: String(id), data: value })}\n\n`;
    })
    .join("");
}

/**
 * Route handler that serves both GET (history) and POST (stream) requests
 * to the Langgraph deploy endpoint.
 *
 * - GET  → JSON `{ messages: [], state: {...} }` (history loading)
 * - POST → SSE `text/event-stream` with `data-state-*` events (stream / polling)
 */
export function mockDeployStream(state: Record<string, unknown>) {
  return async (route: Route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [], state }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: buildSSE(state),
      });
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// DEPLOY STATE FACTORIES
// Pre-built states for every deploy screen.
//
// IMPORTANT: Task names must match the real TaskNames from shared/types/deploy/tasks.ts:
//   ConnectingGoogle, VerifyingGoogle, CheckingBilling,
//   ValidateLinks, RuntimeValidation, FixingBugs,
//   OptimizingSEO, OptimizingPageForLLMs, AddingAnalytics,
//   DeployingWebsite, DeployingCampaign, EnablingCampaign
//
// Phase "CheckingForBugs" maps to tasks [ValidateLinks, RuntimeValidation].
//
// Screen resolution logic (useDeployContentScreen.ts):
// - google-connect:    ConnectingGoogle running + result.action === "oauth_required"
// - invite-accept:     VerifyingGoogle running + no result.status
// - payment-required:  CheckingBilling running + result.action === "payment_required"
// - checking-payment:  CheckingBilling running + result.action === "checking_payment"
// - payment-confirmed: CheckingBilling running + result.has_payment === true
// - waiting-google:    CheckingBilling running + result.action === "waiting_google"
// - deploy-complete:   status === "completed"
// - deploy-error:      status === "failed"
// - in-progress:       default
// ═══════════════════════════════════════════════════════════════

const WEBSITE_TASKS: DeployTask[] = [
  { name: "ValidateLinks", status: "pending" },
  { name: "RuntimeValidation", status: "pending" },
  { name: "OptimizingSEO", status: "pending" },
  { name: "OptimizingPageForLLMs", status: "pending" },
  { name: "AddingAnalytics", status: "pending" },
  { name: "DeployingWebsite", status: "pending" },
];

const CAMPAIGN_TASKS: DeployTask[] = [
  { name: "ConnectingGoogle", status: "pending" },
  { name: "VerifyingGoogle", status: "pending" },
  { name: "CheckingBilling", status: "pending" },
  ...WEBSITE_TASKS,
  { name: "DeployingCampaign", status: "pending" },
  { name: "EnablingCampaign", status: "pending" },
];

function withTaskOverrides(
  tasks: DeployTask[],
  overrides: Record<string, Partial<DeployTask>>
): DeployTask[] {
  return tasks.map((task) => ({
    ...task,
    ...overrides[task.name],
  }));
}

export const DeployStates = {
  // ─── Google Connect Screen ───
  googleConnect: (): DeployState => ({
    status: "running",
    instructions: { googleAds: true, website: true },
    tasks: withTaskOverrides(CAMPAIGN_TASKS, {
      ConnectingGoogle: {
        status: "running",
        result: { action: "oauth_required" },
      },
    }),
  }),

  // ─── Invite Accept Screen ───
  inviteAccept: (): DeployState => ({
    status: "running",
    instructions: { googleAds: true, website: true },
    tasks: withTaskOverrides(CAMPAIGN_TASKS, {
      ConnectingGoogle: {
        status: "completed",
        result: { google_email: "test@launch10.ai" },
      },
      VerifyingGoogle: { status: "running" },
    }),
  }),

  // ─── Payment Required Screen ───
  paymentRequired: (): DeployState => ({
    status: "running",
    instructions: { googleAds: true, website: true },
    tasks: withTaskOverrides(CAMPAIGN_TASKS, {
      ConnectingGoogle: { status: "completed" },
      VerifyingGoogle: {
        status: "completed",
        result: { status: "accepted" },
      },
      CheckingBilling: {
        status: "running",
        result: { action: "payment_required" },
      },
    }),
  }),

  // ─── Checking Payment Screen ───
  checkingPayment: (): DeployState => ({
    status: "running",
    instructions: { googleAds: true, website: true },
    tasks: withTaskOverrides(CAMPAIGN_TASKS, {
      ConnectingGoogle: { status: "completed" },
      VerifyingGoogle: { status: "completed" },
      CheckingBilling: {
        status: "running",
        result: { action: "checking_payment" },
      },
    }),
  }),

  // ─── Payment Confirmed Screen ───
  paymentConfirmed: (): DeployState => ({
    status: "running",
    instructions: { googleAds: true, website: true },
    tasks: withTaskOverrides(CAMPAIGN_TASKS, {
      ConnectingGoogle: { status: "completed" },
      VerifyingGoogle: { status: "completed" },
      CheckingBilling: {
        status: "running",
        result: { has_payment: true },
      },
    }),
  }),

  // ─── Waiting for Google Screen ───
  waitingGoogle: (): DeployState => ({
    status: "running",
    instructions: { googleAds: true, website: true },
    tasks: withTaskOverrides(CAMPAIGN_TASKS, {
      ConnectingGoogle: { status: "completed" },
      VerifyingGoogle: { status: "completed" },
      CheckingBilling: {
        status: "running",
        result: { action: "waiting_google" },
      },
    }),
  }),

  // ─── In-Progress (website) ───
  websiteInProgress: (): DeployState => ({
    status: "running",
    instructions: { website: true },
    tasks: withTaskOverrides(WEBSITE_TASKS, {
      ValidateLinks: { status: "completed" },
      RuntimeValidation: { status: "completed" },
      OptimizingSEO: { status: "completed" },
      AddingAnalytics: { status: "completed" },
      DeployingWebsite: { status: "running" },
    }),
  }),

  // ─── In-Progress (campaign) ───
  campaignInProgress: (): DeployState => ({
    status: "running",
    instructions: { googleAds: true, website: true },
    tasks: withTaskOverrides(CAMPAIGN_TASKS, {
      ConnectingGoogle: { status: "completed" },
      VerifyingGoogle: { status: "completed" },
      CheckingBilling: { status: "completed" },
      ValidateLinks: { status: "completed" },
      RuntimeValidation: { status: "completed" },
      OptimizingSEO: { status: "completed" },
      AddingAnalytics: { status: "completed" },
      DeployingWebsite: { status: "completed" },
      DeployingCampaign: { status: "running" },
    }),
  }),

  // ─── Deploy Complete (website) ───
  websiteComplete: (): DeployState => ({
    status: "completed",
    instructions: { website: true },
    tasks: withTaskOverrides(WEBSITE_TASKS, {
      ValidateLinks: { status: "completed" },
      RuntimeValidation: { status: "completed" },
      OptimizingSEO: { status: "completed" },
      OptimizingPageForLLMs: { status: "completed" },
      AddingAnalytics: { status: "completed" },
      DeployingWebsite: { status: "completed" },
    }),
  }),

  // ─── Deploy Complete (campaign) ───
  campaignComplete: (): DeployState => ({
    status: "completed",
    instructions: { googleAds: true, website: true },
    tasks: withTaskOverrides(CAMPAIGN_TASKS, {
      ConnectingGoogle: { status: "completed" },
      VerifyingGoogle: { status: "completed" },
      CheckingBilling: { status: "completed" },
      ValidateLinks: { status: "completed" },
      RuntimeValidation: { status: "completed" },
      OptimizingSEO: { status: "completed" },
      OptimizingPageForLLMs: { status: "completed" },
      AddingAnalytics: { status: "completed" },
      DeployingWebsite: { status: "completed" },
      DeployingCampaign: { status: "completed" },
      EnablingCampaign: { status: "completed" },
    }),
  }),

  // ─── Failed (with support ticket) ───
  failedWithTicket: (ticketRef = "SR-MOCK1234"): DeployState => ({
    status: "failed",
    instructions: { website: true },
    error: {
      message: "Website deploy failed: build error",
      node: "DeployingWebsite",
    },
    supportTicket: ticketRef,
    tasks: withTaskOverrides(WEBSITE_TASKS, {
      ValidateLinks: { status: "completed" },
      RuntimeValidation: { status: "completed" },
      OptimizingSEO: { status: "completed" },
      DeployingWebsite: {
        status: "failed",
        error: "Website deploy failed: build error",
      },
    }),
  }),

  // ─── Failed (without ticket) ───
  failedWithoutTicket: (): DeployState => ({
    status: "failed",
    instructions: { website: true },
    error: { message: "Transient error", node: "DeployingWebsite" },
    tasks: withTaskOverrides(WEBSITE_TASKS, {
      ValidateLinks: { status: "completed" },
      RuntimeValidation: { status: "completed" },
      DeployingWebsite: { status: "failed", error: "Transient error" },
    }),
  }),

  // ─── Warning Banner ───
  withWarning: (warning: string): DeployState => ({
    status: "running",
    instructions: { website: true },
    tasks: withTaskOverrides(WEBSITE_TASKS, {
      ValidateLinks: { status: "completed" },
      RuntimeValidation: { status: "completed" },
      OptimizingSEO: { status: "completed" },
      AddingAnalytics: { status: "completed" },
      DeployingWebsite: { status: "running", warning },
    }),
  }),

  // ─── Nothing Changed ───
  nothingChanged: (): DeployState => ({
    status: "completed",
    instructions: { website: true },
    nothingChanged: true,
    tasks: withTaskOverrides(WEBSITE_TASKS, {
      ValidateLinks: { status: "completed" },
      RuntimeValidation: { status: "completed" },
      OptimizingSEO: { status: "completed" },
      OptimizingPageForLLMs: { status: "completed" },
      AddingAnalytics: { status: "completed" },
      DeployingWebsite: { status: "completed" },
    }),
  }),
};
