import { 
  workflows, 
  workflow,
  WorkflowTypes,
  StepNames,
  type WorkflowType, 
  type StepName, 
  type Step, 
  type Workflow, 
  type Workflows 
} from "../config/workflow";

export { 
  workflows, 
  workflow,
  WorkflowTypes,
  StepNames,
  type WorkflowType, 
  type StepName, 
  type Step, 
  type Workflow, 
  type Workflows 
};

function flattenSteps(steps: readonly Step[]): StepName[] {
  return steps.flatMap((step): StepName[] => {
    if (step.steps && step.steps.length > 0) {
      return flattenSteps(step.steps);
    }
    return [step.name];
  });
}

function findStepTopLevel(steps: readonly Step[], name: StepName): Step | undefined {
  return steps.find(step => step.name === name);
}

export function getSteps(workflowType: WorkflowType): StepName[] {
  const def = workflows[workflowType];
  return def.steps.map(s => s.name);
}

export function getSubsteps(workflowType: WorkflowType, stepName: StepName): StepName[] {
  const def = workflows[workflowType];
  const step = findStepTopLevel(def.steps, stepName);
  if (!step?.steps) return [];
  return flattenSteps(step.steps);
}

export function getStepOrder(workflowType: WorkflowType, stepName: StepName): number {
  const def = workflows[workflowType];
  const idx = def.steps.findIndex(s => s.name === stepName);
  return idx >= 0 ? idx + 1 : -1;
}

export function stepExists(workflowType: WorkflowType, stepName: string): stepName is StepName {
  const def = workflows[workflowType];
  return def.steps.some(s => s.name === stepName);
}

export function substepExists(workflowType: WorkflowType, stepName: StepName, substep: string): substep is StepName {
  return getSubsteps(workflowType, stepName).includes(substep as StepName);
}

export function getFirstStep(workflowType: WorkflowType): StepName {
  const steps = getSteps(workflowType);
  if (steps.length === 0) {
    throw new Error(`No steps found for workflow type: ${workflowType}`);
  }
  return steps[0]!;
}

export function getFirstSubstep(workflowType: WorkflowType, stepName: StepName): StepName | undefined {
  return getSubsteps(workflowType, stepName)[0];
}

export function getLastSubstep(workflowType: WorkflowType, stepName: StepName): StepName | undefined {
  const substeps = getSubsteps(workflowType, stepName);
  return substeps[substeps.length - 1];
}

export function getNextStep(workflowType: WorkflowType, currentStep: StepName): StepName | undefined {
  const steps = getSteps(workflowType);
  const idx = steps.indexOf(currentStep);
  return idx >= 0 ? steps[idx + 1] : undefined;
}

export function getPrevStep(workflowType: WorkflowType, currentStep: StepName): StepName | undefined {
  const steps = getSteps(workflowType);
  const idx = steps.indexOf(currentStep);
  return idx > 0 ? steps[idx - 1] : undefined;
}

export function getNextSubstep(workflowType: WorkflowType, stepName: StepName, currentSubstep: StepName): StepName | undefined {
  const substeps = getSubsteps(workflowType, stepName);
  const idx = substeps.indexOf(currentSubstep);
  return idx >= 0 ? substeps[idx + 1] : undefined;
}

export function getPrevSubstep(workflowType: WorkflowType, stepName: StepName, currentSubstep: StepName): StepName | undefined {
  const substeps = getSubsteps(workflowType, stepName);
  const idx = substeps.indexOf(currentSubstep);
  return idx > 0 ? substeps[idx - 1] : undefined;
}

export const LaunchAdCampaignSubsteps = ["content", "highlights", "keywords", "settings", "launch", "review"] as const;
export type LaunchAdCampaignSubstep = typeof LaunchAdCampaignSubsteps[number];

export const LaunchLaunchSubsteps = ["settings", "review", "deployment"] as const;
export type LaunchLaunchSubstep = typeof LaunchLaunchSubsteps[number];

export type LaunchStep = "brainstorm" | "website" | "ad_campaign" | "launch";
