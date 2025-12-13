import AdCampaignStepNumber from "./AdCampaignStepNumber";
import AdCampaignSubstep from "./AdCampaignSubstep";

import type { SubStepType } from "./ad-campaign.types";

export default function AdCampaignStep({
  step,
  stepName,
  isActive,
  subSteps,
}: {
  step: number;
  stepName: string;
  isActive?: boolean;
  subSteps?: SubStepType[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <AdCampaignStepNumber step={step} isActive={isActive} />
        <span className="text-base-600">{stepName}</span>
      </div>
      {isActive && (
        <ul className="list-none ml-6">
          {subSteps?.map((subStep, index) => (
            <AdCampaignSubstep key={index} subStep={subStep} />
          ))}
        </ul>
      )}
    </div>
  );
}
