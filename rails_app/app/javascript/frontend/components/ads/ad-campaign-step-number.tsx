import { twMerge } from "tailwind-merge";

type AdCampaignStepNumberProps = {
  step: number;
  isActive?: boolean;
};

export default function AdCampaignStepNumber({
  step,
  isActive = false,
}: AdCampaignStepNumberProps) {
  return (
    <div
      className={twMerge(
        "w-5 h-5 rounded flex items-center justify-center",
        isActive ? "bg-[#3748B8]" : "bg-[#EDEDEC]"
      )}
    >
      <span className={twMerge(isActive ? "text-white" : "text-[#8B8986]")}>{step}</span>
    </div>
  );
}
