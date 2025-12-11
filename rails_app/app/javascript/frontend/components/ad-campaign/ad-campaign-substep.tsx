import type { SubStepType } from "./ad-campaign.types";
import { Check } from "lucide-react";

export default function AdCampaignSubstep({ subStep }: { subStep: SubStepType }) {
  return (
    <li className="flex items-center gap-2">
      {!subStep.isSubStepCompleted ? (
        <span className="w-3 text-base-600">&#8226;</span>
      ) : (
        <span className="w-3 text-base-400">
          <Check size={12} />
        </span>
      )}
      <span className={subStep.isSubStepActive ? "text-base-600" : "text-base-400"}>
        {subStep.label}
      </span>
    </li>
  );
}
