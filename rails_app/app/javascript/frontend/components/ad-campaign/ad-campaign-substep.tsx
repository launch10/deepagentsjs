import type { SubStepType } from "./ad-campaign.types";
import { Check } from "lucide-react";

export default function AdCampaignSubstep({ subStep }: { subStep: SubStepType }) {
  return (
    <li className="flex items-center gap-2">
      {!subStep.isSubStepCompleted ? (
        <span className="w-3 text-primary">&#8226;</span>
      ) : (
        <span className="w-3 text-[#74767A]">
          <Check size={12} />
        </span>
      )}
      <span className={subStep.isSubStepActive ? "text-primary" : "text-[#74767A]"}>
        {subStep.label}
      </span>
    </li>
  );
}
