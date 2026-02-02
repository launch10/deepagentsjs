export const WorkflowTypes = ["launch"] as const;
export type WorkflowType = typeof WorkflowTypes[number];

export const StepNames = [
  "brainstorm", "website", "ad_campaign", "deploy",
  "create", "content", "highlights", "plan", "keywords", "settings",
  "review", "launch",
  "build", "domain"  // Website substeps
] as const;
export type StepName = typeof StepNames[number];
export interface Step {
  name: StepName;
  /** Short label for navigation/stepper (e.g., "Landing Page") */
  label: string;
  /** Optional longer title for section headings (e.g., "Landing Page Launch"). Falls back to label if not set. */
  title?: string;
  order: number;
  steps?: Step[];
}

export type Workflow = { steps: Step[] };
export type Workflows = Record<WorkflowType, Workflow>;

export const WorkflowPages = ["brainstorm", "website", "ad_campaign", "deploy"] as const;
export type WorkflowPage = typeof WorkflowPages[number];

export const AdCampaignStepNames = ["create", "plan", "launch"] as const;
export type AdCampaignStepName = typeof AdCampaignStepNames[number];

export const AdCampaignSubstepNames = ["content", "highlights", "keywords", "settings", "launch", "review"] as const;
export type AdCampaignSubstepName = typeof AdCampaignSubstepNames[number];

// Website substeps (mirrors ad_campaign pattern)
export const WebsiteSubstepNames = ["build", "domain", "deploy"] as const;
export type WebsiteSubstepName = typeof WebsiteSubstepNames[number];

// All substeps across all pages
export const SubstepNames = [...AdCampaignSubstepNames, ...WebsiteSubstepNames] as const;
export type SubstepName = typeof SubstepNames[number];

export const workflows = {
  launch: {
    steps: [
      { name: "brainstorm", label: "Brainstorm", order: 1 },
      { name: "website", label: "Landing Page", title: "Landing Page Designer", order: 2,
        steps: [
          { name: "build", label: "Page Overview", order: 1 },
          { name: "domain", label: "Website Setup", order: 2 },
          { name: "deploy", label: "Launch", order: 3 }
        ]
      },
      { name: "ad_campaign", label: "Ad Campaign", order: 3,
        steps: [
          {
            name: "create",
            label: "Create",
            order: 1,
            steps: [
              { name: "content", label: "Content", order: 1 },
              { name: "highlights", label: "Highlights", order: 2 }
            ]
          },
          {
            name: "plan",
            label: "Plan",
            order: 2,
            steps: [
              { name: "keywords", label: "Keyword Targeting", order: 1 },
              { name: "settings", label: "Settings", order: 2 }
            ]
          },
          {
            name: "launch",
            label: "Launch",
            order: 3,
            steps: [
              { name: "launch", label: "Launch", order: 1 },
              { name: "review", label: "Review", order: 2 }
            ]
          }
        ]
      },
      { name: "deploy", label: "Deploy", order: 4 }
    ]
  }
} as const satisfies Workflows;

type AdCampaignSteps = typeof workflows.launch.steps[2]["steps"];
type ExtractAdCampaignTabGroups<T extends readonly any[]> = {
  [K in T[number]["name"]]: Extract<T[number], { name: K }>["steps"] extends readonly { name: infer SN }[]
    ? SN
    : never;
};

export type TabGroupTabNames = ExtractAdCampaignTabGroups<NonNullable<AdCampaignSteps>>;
export type TabGroupName = keyof TabGroupTabNames;

const adCampaignSteps = workflows.launch.steps[2].steps!;
export const TabGroups = Object.fromEntries(
  adCampaignSteps.map((group) => [group.name, group.steps])
) as { [K in TabGroupName]: Extract<NonNullable<AdCampaignSteps>[number], { name: K }>["steps"] };

export function findTabs<T extends TabGroupName>(groupName: T): typeof TabGroups[T] {
  return TabGroups[groupName];
}

const tabGroupNames: readonly TabGroupName[] = ["create", "plan", "launch"] as const;
export function isTabGroupName(name: string | null | undefined): name is TabGroupName {
  return typeof name === "string" && tabGroupNames.includes(name as TabGroupName);
}

const substepToStepMap: Partial<Record<SubstepName, AdCampaignStepName>> = {
  content: "create",
  highlights: "create",
  keywords: "plan",
  settings: "plan",
  launch: "launch",
  review: "launch",
};

export function deriveStep(substep: SubstepName | null | undefined): AdCampaignStepName | null {
  if (!substep) return null;
  return substepToStepMap[substep] ?? null;
}

/**
 * Get the step definition for a given page name from the workflow
 */
export function getStepForPage(pageName: WorkflowPage): Step | undefined {
  return workflows.launch.steps.find((s) => s.name === pageName);
}

/**
 * Get the ordered list of substep names for a page
 */
export function getSubstepOrder(pageName: WorkflowPage): readonly string[] {
  switch (pageName) {
    case "website":
      return WebsiteSubstepNames;
    case "ad_campaign":
      return AdCampaignSubstepNames;
    default:
      return [];
  }
}

/**
 * Determines if a substep is completed based on the current active substep.
 * A substep is considered completed if it comes before the active substep in the order.
 */
export function isSubstepCompleted(
  substepName: string,
  activeSubstep: string | null | undefined,
  substepOrder: readonly string[]
): boolean {
  if (!activeSubstep) return false;

  const currentIndex = substepOrder.indexOf(activeSubstep);
  const substepIndex = substepOrder.indexOf(substepName);

  // If either index is -1 (not found), return false
  if (currentIndex === -1 || substepIndex === -1) return false;

  // A substep is completed if it comes before the current active substep
  return substepIndex < currentIndex;
}

export const workflow = workflows;
