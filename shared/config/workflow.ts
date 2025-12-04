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
  steps?: Step[];
}

export type Workflow = { steps: Step[] };
export type Workflows = Record<WorkflowType, Workflow>;

export const AdCampaignSteps = ["content", "highlights", "keywords", "settings", "launch", "review"] as const;
export type AdCampaignStep = typeof AdCampaignSteps[number];

export const workflows: Workflows = {
  launch: {
    steps: [
      { name: "brainstorm", label: "Brainstorm" },
      { name: "website", label: "Website" },
      { name: "ad_campaign", label: "Ad Campaign",
        steps: [
          {
            name: "create",
            label: "Create",
            steps: [
              { name: "content", label: "Content" },
              { name: "highlights", label: "Highlights" }
            ]
          },
          {
            name: "plan",
            label: "Plan",
            steps: [
              { name: "keywords", label: "Keywords" },
              { name: "settings", label: "Settings" }
            ]
          },
          {
            name: "launch",
            label: "Launch",
            steps: [
              { name: "launch", label: "Launch" },
              { name: "review", label: "Review" }
            ]
          }
        ]
      },
      { name: "launch", label: "Launch",
        steps: [
          { name: "settings", label: "Settings" },
          { name: "review", label: "Review" },
          { name: "deployment", label: "Deployment" }
        ]
      }
    ]
  }
};

export const workflow = workflows;
