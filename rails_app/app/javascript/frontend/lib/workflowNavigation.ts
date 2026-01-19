/**
 * Pure utility functions for workflow navigation.
 * These functions are stateless and easy to unit test.
 *
 * The workflow has 4 main pages:
 * 1. brainstorm (no substeps)
 * 2. website (no substeps)
 * 3. ad_campaign (substeps: content, highlights, keywords, settings, launch, review)
 * 4. deploy (no substeps - final deployment step)
 */
import { Workflow } from "@shared";

/**
 * Ordered list of workflow pages
 */
export const PAGE_ORDER: readonly Workflow.WorkflowPage[] = [
  "brainstorm",
  "website",
  "ad_campaign",
  "deploy",
] as const;

/**
 * Position in the workflow
 */
export interface WorkflowPosition {
  page: Workflow.WorkflowPage | null;
  substep: Workflow.SubstepName | null;
}

/**
 * Get the initial page for a new workflow (starting from nothing)
 */
export function getInitialPage(): Workflow.WorkflowPage {
  return "brainstorm";
}

/**
 * Get the index of a page in the workflow order
 * Returns -1 if page is null or not found
 */
export function getPageIndex(page: Workflow.WorkflowPage | null): number {
  if (!page) return -1;
  return PAGE_ORDER.indexOf(page);
}

/**
 * Get the next page in the workflow
 * Returns null if already at the last page or if current page is null
 */
export function getNextPage(current: Workflow.WorkflowPage | null): Workflow.WorkflowPage | null {
  if (!current) return getInitialPage();

  const currentIndex = getPageIndex(current);
  if (currentIndex === -1 || currentIndex >= PAGE_ORDER.length - 1) {
    return null;
  }

  return PAGE_ORDER[currentIndex + 1];
}

/**
 * Get the previous page in the workflow
 * Returns null if already at the first page or if current page is null
 */
export function getPreviousPage(
  current: Workflow.WorkflowPage | null
): Workflow.WorkflowPage | null {
  if (!current) return null;

  const currentIndex = getPageIndex(current);
  if (currentIndex <= 0) {
    return null;
  }

  return PAGE_ORDER[currentIndex - 1];
}

/**
 * Check if the given page is the first page in the workflow
 */
export function isFirstPage(page: Workflow.WorkflowPage | null): boolean {
  return page === "brainstorm";
}

/**
 * Check if the given page is the last page in the workflow
 */
export function isLastPage(page: Workflow.WorkflowPage | null): boolean {
  return page === "deploy";
}

/**
 * Get the first substep for a page that has substeps
 * Returns null for pages without substeps (brainstorm, website, deploy)
 */
export function getFirstSubstep(page: Workflow.WorkflowPage): Workflow.SubstepName | null {
  switch (page) {
    case "brainstorm":
    case "website":
    case "deploy":
      return null;
    case "ad_campaign":
      return "content";
    default:
      return null;
  }
}

/**
 * Get the last substep for a page that has substeps
 * Returns null for pages without substeps (brainstorm, website, deploy)
 */
export function getLastSubstep(page: Workflow.WorkflowPage): Workflow.SubstepName | null {
  switch (page) {
    case "brainstorm":
    case "website":
    case "deploy":
      return null;
    case "ad_campaign":
      return "review";
    default:
      return null;
  }
}

/**
 * Check if a page has substeps
 */
export function pageHasSubsteps(page: Workflow.WorkflowPage | null): boolean {
  return page === "ad_campaign";
}

/**
 * Continue from current position to next position in the workflow.
 * This handles both page-level and substep-level transitions.
 *
 * Transitions:
 * - (null) → brainstorm
 * - brainstorm → website
 * - website → ad_campaign/content
 * - ad_campaign substeps → next substep or deploy
 * - deploy → stay at deploy (end of workflow)
 */
export function continueWorkflow(position: WorkflowPosition): WorkflowPosition {
  const { page, substep } = position;

  // Case 1: No page set → start at brainstorm
  if (!page) {
    return { page: "brainstorm", substep: null };
  }

  // Case 2: Pages without substeps → move to next page
  if (page === "brainstorm") {
    return { page: "website", substep: null };
  }

  if (page === "website") {
    return { page: "ad_campaign", substep: "content" };
  }

  // Case 3: Ad campaign with substeps
  if (page === "ad_campaign") {
    const nextSubstep = getNextAdCampaignSubstep(substep);
    if (nextSubstep) {
      return { page: "ad_campaign", substep: nextSubstep };
    }
    // End of ad_campaign → go to deploy (no substeps)
    return { page: "deploy", substep: null };
  }

  // Case 4: Deploy has no substeps - end of workflow
  if (page === "deploy") {
    return position;
  }

  return position;
}

/**
 * Go back from current position to previous position in the workflow.
 * This handles both page-level and substep-level transitions.
 */
export function backWorkflow(position: WorkflowPosition): WorkflowPosition {
  const { page, substep } = position;

  // Case 1: No page set → stay at null
  if (!page) {
    return position;
  }

  // Case 2: Brainstorm (first page) → can't go back
  if (page === "brainstorm") {
    return position;
  }

  // Case 3: Website → go back to brainstorm
  if (page === "website") {
    return { page: "brainstorm", substep: null };
  }

  // Case 4: Ad campaign
  if (page === "ad_campaign") {
    const prevSubstep = getPrevAdCampaignSubstep(substep);
    if (prevSubstep) {
      return { page: "ad_campaign", substep: prevSubstep };
    }
    // At first substep → go back to website
    return { page: "website", substep: null };
  }

  // Case 5: Deploy → go back to ad_campaign/review
  if (page === "deploy") {
    return { page: "ad_campaign", substep: "review" };
  }

  return position;
}

// Substep navigation helpers

const AD_CAMPAIGN_SUBSTEP_ORDER: Workflow.AdCampaignSubstepName[] = [
  "content",
  "highlights",
  "keywords",
  "settings",
  "launch",
  "review",
];

function getNextAdCampaignSubstep(
  current: Workflow.SubstepName | null
): Workflow.AdCampaignSubstepName | null {
  if (!current) return "content";
  const currentIndex = AD_CAMPAIGN_SUBSTEP_ORDER.indexOf(current as Workflow.AdCampaignSubstepName);
  if (currentIndex === -1 || currentIndex >= AD_CAMPAIGN_SUBSTEP_ORDER.length - 1) {
    return null;
  }
  return AD_CAMPAIGN_SUBSTEP_ORDER[currentIndex + 1];
}

function getPrevAdCampaignSubstep(
  current: Workflow.SubstepName | null
): Workflow.AdCampaignSubstepName | null {
  if (!current) return null;
  const currentIndex = AD_CAMPAIGN_SUBSTEP_ORDER.indexOf(current as Workflow.AdCampaignSubstepName);
  if (currentIndex <= 0) {
    return null;
  }
  return AD_CAMPAIGN_SUBSTEP_ORDER[currentIndex - 1];
}
