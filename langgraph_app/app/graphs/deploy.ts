import { StateGraph, END, START } from "@langchain/langgraph";
import { DeployAnnotation, type DeployGraphState } from "@annotation";
import { Deploy, Task } from "@types";
import {
  analyticsNode,
  seoOptimizationNode,
  deployWebsiteNode,
  runtimeValidationNode,
  validateLinksNode,
  bugFixNode,
  createEnqueueNode,
  googleConnectNode,
  shouldSkipGoogleConnect,
  verifyGoogleNode,
  shouldSkipGoogleVerify,
  checkPaymentNode,
  shouldCheckPayment,
  enableCampaignNode,
  deployCampaignNode,
} from "@nodes";

/**
 * Maximum retry count for bug fix loop
 */
const MAX_RETRY_COUNT = 2;

/**
 * Deploy Graph (Flat Architecture with Tagged Steps)
 *
 * All deploy tasks in a single flat graph with conditional routing based on
 * state.deploy.website and state.deploy.googleAds flags.
 *
 * Step Tags:
 * - [all]: Runs for all deploy types
 * - [campaign]: Only runs when deploying Google Ads campaigns
 *
 * Flow:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ START                                                                   │
 * │   │                                                                     │
 * │   ▼                                                                     │
 * │ [shouldDeployGoogleAds?]──────────────────────────┐                     │
 * │   │ YES                                           │ NO                  │
 * │   ▼                                               │                     │
 * │ googleConnect (OAuth popup) [campaign]            │                     │
 * │   │                                               │                     │
 * │   ▼                                               │                     │
 * │ setupGoogleAds (verifyGoogle) [campaign]          │                     │
 * │   │ (creates account + conversion action          │                     │
 * │   │  + sends invite + waits for accept)           │                     │
 * │   │                                               │                     │
 * │   └───────────────────────────────────────────────┘                     │
 * │                   │                                                     │
 * │                   ▼                                                     │
 * │         websiteValidation [all]                                         │
 * │         ┌─────────────────────────┐                                     │
 * │         │ validateLinks           │                                     │
 * │         │     │                   │                                     │
 * │         │     ↓                   │                                     │
 * │         │ runtimeValidation       │                                     │
 * │         │     │     │             │                                     │
 * │         │     │  bugFix ←─────────│ (retry loop, max 2)                 │
 * │         │     ↓                   │                                     │
 * │         └─────────────────────────┘                                     │
 * │                   │                                                     │
 * │                   ▼                                                     │
 * │              analytics [all]                                            │
 * │         (L10.createLead instrumentation)                                │
 * │                   │                                                     │
 * │                   ▼                                                     │
 * │           seoOptimization [all]                                         │
 * │                   │                                                     │
 * │                   ▼                                                     │
 * │            deployWebsite [all]                                          │
 * │      (build! injects google_send_to)                                    │
 * │                   │                                                     │
 * │                   ▼                                                     │
 * │       [shouldDeployGoogleAds?]                                          │
 * │         │ YES              │ NO                                         │
 * │         ▼                  │                                            │
 * │   createCampaign [campaign]│                                            │
 * │   (keywords, ads, budget)  │                                            │
 * │         │                  │                                            │
 * │         ▼                  │                                            │
 * │   checkPayment [campaign]  │                                            │
 * │         │                  │                                            │
 * │         ▼                  │                                            │
 * │   enableCampaign [campaign]│                                            │
 * │   (blocked if no payment)  │                                            │
 * │         │                  │                                            │
 * │         └──────────────────┘                                            │
 * │                   │                                                     │
 * │                   ▼                                                     │
 * │                  END                                                    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Key Dependency: Google setup MUST complete before deployWebsite
 * because buildable.rb reads conversion action info (google_send_to)
 * from AdsAccount during the build phase.
 */

// ==============================================================================
// GRAPH DEFINITION
// ==============================================================================

export const deployGraph = new StateGraph(DeployAnnotation)
  // --------------------------------------------------------------------------
  // Google Setup Nodes [campaign]
  // --------------------------------------------------------------------------
  .addNode("enqueueGoogleConnect", createEnqueueNode("ConnectingGoogle"))
  .addNode("googleConnect", googleConnectNode)
  .addNode("checkGoogleVerify", async () => ({})) // Pass-through for routing
  .addNode("enqueueGoogleVerify", createEnqueueNode("VerifyingGoogle"))
  .addNode("verifyGoogle", verifyGoogleNode)

  // --------------------------------------------------------------------------
  // Website Validation Nodes [all] (mini-loop for validate → bugfix → retry)
  // --------------------------------------------------------------------------
  .addNode("enqueueValidateLinks", createEnqueueNode("ValidateLinks"))
  .addNode("validateLinks", validateLinksNode)
  .addNode("enqueueRuntimeValidation", createEnqueueNode("RuntimeValidation"))
  .addNode("runtimeValidation", runtimeValidationNode)
  .addNode("enqueueBugFix", createEnqueueNode("FixingBugs"))
  .addNode("bugFix", bugFixNode)

  // --------------------------------------------------------------------------
  // Website Preparation & Deploy Nodes [all]
  // --------------------------------------------------------------------------
  .addNode("enqueueAnalytics", createEnqueueNode("AddingAnalytics"))
  .addNode("analytics", analyticsNode)
  .addNode("enqueueSEOOptimization", createEnqueueNode("OptimizingSEO"))
  .addNode("seoOptimization", seoOptimizationNode)
  .addNode("enqueueDeploy", createEnqueueNode("DeployingWebsite"))
  .addNode("deployWebsite", deployWebsiteNode)

  // --------------------------------------------------------------------------
  // Campaign Nodes [campaign]
  // --------------------------------------------------------------------------
  .addNode("enqueueDeployCampaign", createEnqueueNode("DeployingCampaign"))
  .addNode("deployCampaign", deployCampaignNode)
  .addNode("enqueueCheckPayment", createEnqueueNode("CheckingBilling"))
  .addNode("checkPayment", checkPaymentNode)
  .addNode("enqueueEnableCampaign", createEnqueueNode("EnablingCampaign"))
  .addNode("enableCampaign", enableCampaignNode)

  // ==========================================================================
  // ROUTING
  // ==========================================================================

  // --------------------------------------------------------------------------
  // START: Branch based on whether we're deploying Google Ads
  // --------------------------------------------------------------------------
  .addConditionalEdges(START, (state: DeployGraphState) => {
    // Exit early if nothing to deploy
    if (!Deploy.shouldDeployAnything(state)) return END;

    // If deploying Google Ads, start with Google Connect flow
    if (Deploy.shouldDeployGoogleAds(state)) {
      return "checkGoogleConnect";
    }

    // Website-only deploy: skip to validation
    return "enqueueValidateLinks";
  })

  // Routing node for Google Connect
  .addNode("checkGoogleConnect", async () => ({}))
  .addConditionalEdges("checkGoogleConnect", shouldSkipGoogleConnect, {
    skipGoogleConnect: "checkGoogleVerify",
    enqueueGoogleConnect: "enqueueGoogleConnect",
  })

  // --------------------------------------------------------------------------
  // Google Connect Flow [campaign]
  // --------------------------------------------------------------------------
  .addEdge("enqueueGoogleConnect", "googleConnect")
  .addEdge("googleConnect", "checkGoogleVerify")

  // --------------------------------------------------------------------------
  // Google Verify Flow [campaign]
  // --------------------------------------------------------------------------
  .addConditionalEdges("checkGoogleVerify", shouldSkipGoogleVerify, {
    skipGoogleVerify: "enqueueValidateLinks", // Proceed to website validation
    enqueueGoogleVerify: "enqueueGoogleVerify",
  })
  .addEdge("enqueueGoogleVerify", "verifyGoogle")
  .addEdge("verifyGoogle", "enqueueValidateLinks")

  // --------------------------------------------------------------------------
  // Website Validation Flow [all] (validate → runtime → bugfix loop)
  // --------------------------------------------------------------------------
  .addEdge("enqueueValidateLinks", "validateLinks")

  // Link validation routing
  .addConditionalEdges("validateLinks", (state: DeployGraphState) => {
    const task = Task.findTask(state.tasks, "ValidateLinks");
    if (task?.status === "completed") {
      return "enqueueRuntimeValidation";
    }
    return "enqueueBugFix";
  })

  .addEdge("enqueueRuntimeValidation", "runtimeValidation")

  // Runtime validation routing: pass → analytics, fail → bugfix (with retry limit)
  .addConditionalEdges("runtimeValidation", (state: DeployGraphState) => {
    const task = Task.findTask(state.tasks, "RuntimeValidation");
    if (task?.status === "completed") {
      return "enqueueAnalytics";
    }
    const retryCount = task?.retryCount || 0;
    if (retryCount >= MAX_RETRY_COUNT) {
      return END; // Max retries reached, exit
    }
    return "enqueueBugFix";
  })

  // Bug fix loops back to validateLinks
  .addEdge("enqueueBugFix", "bugFix")
  .addEdge("bugFix", "validateLinks")

  // --------------------------------------------------------------------------
  // Website Preparation [all]
  // --------------------------------------------------------------------------
  .addEdge("enqueueAnalytics", "analytics")
  .addEdge("analytics", "enqueueSEOOptimization")
  .addEdge("enqueueSEOOptimization", "seoOptimization")
  .addEdge("seoOptimization", "enqueueDeploy")
  .addEdge("enqueueDeploy", "deployWebsite")

  // --------------------------------------------------------------------------
  // After Website Deploy: Check if we should proceed to Campaign [campaign]
  // --------------------------------------------------------------------------
  .addConditionalEdges("deployWebsite", (state: DeployGraphState) => {
    const websiteTask = Task.findTask(state.tasks, "DeployingWebsite");

    // If website deploy failed, don't proceed to campaign
    if (websiteTask?.status === "failed") return END;

    // If website deploy not yet completed, exit (waiting for webhook)
    if (websiteTask?.status !== "completed") return END;

    // Website completed - proceed to campaign if needed
    if (Deploy.shouldDeployGoogleAds(state)) {
      return "enqueueDeployCampaign";
    }

    return END;
  })

  // --------------------------------------------------------------------------
  // Campaign Deploy Flow [campaign]
  // --------------------------------------------------------------------------
  .addEdge("enqueueDeployCampaign", "deployCampaign")

  // After campaign is created, check payment before enabling
  .addConditionalEdges("deployCampaign", (state: DeployGraphState) => {
    const task = Task.findTask(state.tasks, "DeployingCampaign");

    // If campaign deploy failed, exit
    if (task?.status === "failed") return END;

    // If campaign deploy not yet completed, exit (waiting for webhook)
    if (task?.status !== "completed") return END;

    // Campaign created - check payment
    return "checkPaymentOrSkip";
  })

  // Routing node for payment check
  .addNode("checkPaymentOrSkip", async () => ({}))
  .addConditionalEdges("checkPaymentOrSkip", shouldCheckPayment, {
    skipCheckPayment: "enqueueEnableCampaign",
    checkPayment: "enqueueCheckPayment",
  })

  .addEdge("enqueueCheckPayment", "checkPayment")

  // After payment check, enable campaign
  .addConditionalEdges("checkPayment", (state: DeployGraphState) => {
    const task = Task.findTask(state.tasks, "CheckingBilling");

    // If payment check failed, exit
    if (task?.status === "failed") return END;

    // If payment check not yet completed, exit (waiting for webhook)
    if (task?.status !== "completed") return END;

    // Payment verified - enable campaign
    return "enqueueEnableCampaign";
  })

  // --------------------------------------------------------------------------
  // Enable Campaign [campaign]
  // --------------------------------------------------------------------------
  .addEdge("enqueueEnableCampaign", "enableCampaign")
  .addEdge("enableCampaign", END);
