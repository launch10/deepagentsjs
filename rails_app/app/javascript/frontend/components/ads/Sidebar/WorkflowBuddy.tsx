import { CardTitle, CardDescription, CardHeader } from "@components/ui/card";
import AdCampaignStep from "../ad-campaign-step";
import { workflow as adCampaignWorkflow } from "@shared";

export default function WorkflowBuddy({
  activeStep,
  activeSubstep,
}: {
  activeStep?: string;
  activeSubstep?: string;
}) {
  const adCampaignSteps = adCampaignWorkflow.launch.steps.find(
    (step) => step.name === "ad_campaign"
  )?.steps;

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
