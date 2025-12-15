import type { SubStepType } from "./ad-campaign.types";
import { Check } from "lucide-react";

export default function AdCampaignSubstep({ subStep }: { subStep: SubStepType }) {
  return (
    <li className="flex items-center gap-2">
      {!subStep.isSubStepCompleted ? (
        <span className="size-1 rounded-full bg-current text-base-600" />
      ) : (
        <span className="text-base-400">
          <Check size={12} />
        </span>
      )}
      <span className={`text-xs ${subStep.isSubStepActive ? "text-base-600 font-medium" : "text-base-400"}`}>
        {subStep.label}
      </span>
    </li>
  );
}
