import { CardTitle, CardDescription, CardHeader } from "@components/ui/card";
import AdCampaignStep from "./WorkflowBuddy/AdCampaignStep";
import { Workflow } from "@shared";
import { useWorkflowSteps, selectStep, selectSubstep } from "@context/WorkflowStepsProvider";

const adCampaignSteps = Workflow.workflows.launch.steps.find(
  (step) => step.name === "ad_campaign"
)?.steps;

export type WorkflowBuddyViewProps = {
  activeStep?: string | null;
  activeSubstep?: string | null;
};

export function WorkflowBuddyView({ activeStep, activeSubstep }: WorkflowBuddyViewProps) {
  return (
    <CardHeader>
      <CardTitle className="text-lg font-medium">Ad Campaign</CardTitle>
      <CardDescription className="flex flex-col gap-3">
        <div className="font-medium">Steps</div>
        {adCampaignSteps?.map((step) => (
          <AdCampaignStep
            key={step.name}
            step={step.order}
            stepName={step.label}
            isActive={step.name === activeStep}
            subSteps={step.steps?.map((subStep) => ({
              label: subStep.label,
              isSubStepActive: subStep.name === activeSubstep,
            }))}
          />
        ))}
      </CardDescription>
    </CardHeader>
  );
}

export default function WorkflowBuddy() {
  const activeStep = useWorkflowSteps(selectStep);
  const activeSubstep = useWorkflowSteps(selectSubstep);

  return <WorkflowBuddyView activeStep={activeStep} activeSubstep={activeSubstep} />;
}
