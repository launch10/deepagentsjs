import { twMerge } from "tailwind-merge";
import { Check } from "lucide-react";

export interface WebsiteWorkflowStepProps {
  step: number;
  stepName: string;
  isActive?: boolean;
  isCompleted?: boolean;
}

function StepNumber({
  step,
  isActive = false,
  isCompleted = false,
}: {
  step: number;
  isActive?: boolean;
  isCompleted?: boolean;
}) {
  return (
    <div
      className={twMerge(
        "w-5 h-5 rounded flex items-center justify-center text-xs",
        isActive
          ? "bg-[#3748B8] text-white"
          : isCompleted
            ? "bg-success-100 text-success-600"
            : "bg-[#EDEDEC] text-[#8B8986]"
      )}
    >
      {isCompleted ? <Check size={12} /> : <span>{step}</span>}
    </div>
  );
}

export function WebsiteWorkflowStep({
  step,
  stepName,
  isActive = false,
  isCompleted = false,
}: WebsiteWorkflowStepProps) {
  return (
    <div className="flex gap-2 items-center">
      <StepNumber step={step} isActive={isActive} isCompleted={isCompleted} />
      <span
        className={twMerge(
          "text-sm",
          isActive ? "text-base-600 font-medium" : isCompleted ? "text-base-400" : "text-base-400"
        )}
      >
        {stepName}
      </span>
    </div>
  );
}
