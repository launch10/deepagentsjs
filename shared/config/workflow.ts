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

export const AdCampaignSteps = ["content", "highlights", "keywords", "settings", "launch", "review"] as const;
export type AdCampaignStep = typeof AdCampaignSteps[number];

export const workflows: Workflows = {
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
};

export const workflow = workflows;
