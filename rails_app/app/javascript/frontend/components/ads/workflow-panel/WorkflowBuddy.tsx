import { CardTitle, CardDescription, CardHeader } from "@components/ui/card";
import AdCampaignStep from "./workflow-buddy/AdCampaignStep";
import { Workflow } from "@shared";
import { useWorkflow, selectStep, selectSubstep } from "@context/WorkflowProvider";

const adCampaignSteps = Workflow.workflows.launch.steps.find(
  (step) => step.name === "ad_campaign"
)?.steps;

export type WorkflowBuddyViewProps = {
  activeStep?: string | null;
  activeSubstep?: string | null;
};

/**
 * Determines if a substep is completed based on the current active substep.
 * A substep is considered completed if it comes before the active substep in the order.
 */
function isSubStepCompleted(
  substepName: string,
  activeSubstep: string | null | undefined
): boolean {
  if (!activeSubstep) return false;

  const substepOrder = Workflow.AdCampaignSubstepNames;
  const currentIndex = substepOrder.indexOf(activeSubstep as Workflow.AdCampaignSubstepName);
  const substepIndex = substepOrder.indexOf(substepName as Workflow.AdCampaignSubstepName);

  // If either index is -1 (not found), return false
  if (currentIndex === -1 || substepIndex === -1) return false;

  // A substep is completed if it comes before the current active substep
  return substepIndex < currentIndex;
}

export function WorkflowBuddyView({ activeStep, activeSubstep }: WorkflowBuddyViewProps) {
  return (
    <CardHeader className="px-4 py-4">
      <CardTitle className="text-lg font-semibold font-serif">Ad Campaign</CardTitle>
      <CardDescription className="flex flex-col gap-[18px]">
        <div className="font-medium text-sm text-base-400">Steps</div>
        {adCampaignSteps?.map((step) => (
          <AdCampaignStep
            key={step.name}
            step={step.order}
            stepName={step.label}
            isActive={step.name === activeStep}
            subSteps={step.steps?.map((subStep) => ({
              label: subStep.label,
              isSubStepActive: subStep.name === activeSubstep,
              isSubStepCompleted: isSubStepCompleted(subStep.name, activeSubstep),
            }))}
          />
        ))}
      </CardDescription>
    </CardHeader>
  );
}

export default function WorkflowBuddy() {
  const activeStep = useWorkflow(selectStep);
  const activeSubstep = useWorkflow(selectSubstep);

  return <WorkflowBuddyView activeStep={activeStep} activeSubstep={activeSubstep} />;
}
