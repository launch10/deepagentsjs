import { number } from "zod";

export const WorkflowTypes = ["launch"] as const;
export type WorkflowType = typeof WorkflowTypes[number];

export const StepNames = [
  "brainstorm", "website", "ad_campaign", "launch",
  "create", "content", "highlights", "plan", "keywords", "settings", 
  "review", "deployment"
] as const;
export type StepName = typeof StepNames[number];
export interface Step {
  name: StepName;
  label: string;
  order: number;
  steps?: Step[];
}

export type Workflow = { steps: Step[] };
export type Workflows = Record<WorkflowType, Workflow>;

export const WorkflowPages = ["brainstorm", "website", "ad_campaign", "launch"] as const;
export type WorkflowPage = typeof WorkflowPages[number];

export const AdCampaignStepNames = ["create", "plan", "launch"] as const;
export type AdCampaignStepName = typeof AdCampaignStepNames[number];

export const SubstepNames = ["content", "highlights", "keywords", "settings", "launch", "review"] as const;
export type SubstepName = typeof SubstepNames[number];

export const workflows = {
  launch: {
    steps: [
      { name: "brainstorm", label: "Brainstorm", order: 1 },
      { name: "website", label: "Website", order: 2 },
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
              { name: "keywords", label: "Keywords", order: 1 },
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
      { name: "launch", label: "Launch", order: 4,
        steps: [
          { name: "settings", label: "Settings", order: 1 },
          { name: "review", label: "Review", order: 2 },
          { name: "deployment", label: "Deployment", order: 3 }
        ]
      }
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

const substepToStepMap: Record<SubstepName, AdCampaignStepName> = {
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

export const workflow = workflows;
