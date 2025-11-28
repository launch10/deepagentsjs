import { workflow } from "../config/workflow";

export { workflow };

export type WorkflowConfig = typeof workflow;
export type WorkflowType = keyof WorkflowConfig;

export type StepsFor<W extends WorkflowType> = keyof WorkflowConfig[W]["steps"];

export type SubstepsFor<
  W extends WorkflowType,
  S extends StepsFor<W>
> = WorkflowConfig[W]["steps"][S] extends { substeps: readonly (infer U)[] }
  ? U
  : never;

export type LaunchStep = StepsFor<"launch">;
export const LaunchAdCampaignSubsteps = getSubsteps("launch", "ad_campaign");
export type LaunchAdCampaignSubstep = typeof LaunchAdCampaignSubsteps[number];
export type LaunchLaunchSubstep = SubstepsFor<"launch", "launch">;

export function getSteps<W extends WorkflowType>(workflowType: W): StepsFor<W>[] {
  const def = workflow[workflowType];
  return Object.entries(def.steps)
    .sort(([, a], [, b]) => (a as { order: number }).order - (b as { order: number }).order)
    .map(([name]) => name) as StepsFor<W>[];
}

export function getSubsteps<W extends WorkflowType, S extends StepsFor<W>>(
  workflowType: W,
  step: S
): SubstepsFor<W, S>[] {
  const def = workflow[workflowType];
  const stepConfig = def.steps[step as keyof typeof def.steps] as { substeps?: readonly string[] };
  return (stepConfig?.substeps ?? []) as SubstepsFor<W, S>[];
}

export function getStepOrder<W extends WorkflowType, S extends StepsFor<W>>(
  workflowType: W,
  step: S
): number {
  const def = workflow[workflowType];
  return (def.steps[step as keyof typeof def.steps] as { order: number }).order;
}

export function stepExists<W extends WorkflowType>(
  workflowType: W,
  step: string
): step is StepsFor<W> & string {
  const def = workflow[workflowType];
  return step in def.steps;
}

export function substepExists<W extends WorkflowType, S extends StepsFor<W>>(
  workflowType: W,
  step: S,
  substep: string
): substep is SubstepsFor<W, S> & string {
  return (getSubsteps(workflowType, step) as string[]).includes(substep);
}

export function getFirstStep<W extends WorkflowType>(workflowType: W): StepsFor<W> {
  return getSteps(workflowType)[0];
}

export function getFirstSubstep<W extends WorkflowType, S extends StepsFor<W>>(
  workflowType: W,
  step: S
): SubstepsFor<W, S> | undefined {
  return getSubsteps(workflowType, step)[0];
}

export function getLastSubstep<W extends WorkflowType, S extends StepsFor<W>>(
  workflowType: W,
  step: S
): SubstepsFor<W, S> | undefined {
  const substeps = getSubsteps(workflowType, step);
  return substeps[substeps.length - 1];
}

export function getNextStep<W extends WorkflowType>(
  workflowType: W,
  currentStep: StepsFor<W>
): StepsFor<W> | undefined {
  const steps = getSteps(workflowType);
  const idx = steps.indexOf(currentStep);
  return idx >= 0 ? steps[idx + 1] : undefined;
}

export function getPrevStep<W extends WorkflowType>(
  workflowType: W,
  currentStep: StepsFor<W>
): StepsFor<W> | undefined {
  const steps = getSteps(workflowType);
  const idx = steps.indexOf(currentStep);
  return idx > 0 ? steps[idx - 1] : undefined;
}

export function getNextSubstep<W extends WorkflowType, S extends StepsFor<W>>(
  workflowType: W,
  step: S,
  currentSubstep: SubstepsFor<W, S>
): SubstepsFor<W, S> | undefined {
  const substeps = getSubsteps(workflowType, step);
  const idx = substeps.indexOf(currentSubstep);
  return idx >= 0 ? substeps[idx + 1] : undefined;
}

export function getPrevSubstep<W extends WorkflowType, S extends StepsFor<W>>(
  workflowType: W,
  step: S,
  currentSubstep: SubstepsFor<W, S>
): SubstepsFor<W, S> | undefined {
  const substeps = getSubsteps(workflowType, step);
  const idx = substeps.indexOf(currentSubstep);
  return idx > 0 ? substeps[idx - 1] : undefined;
}
