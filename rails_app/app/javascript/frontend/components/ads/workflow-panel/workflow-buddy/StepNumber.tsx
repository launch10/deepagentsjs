import { twMerge } from "tailwind-merge";
import { Check } from "lucide-react";

type StepNumberProps = {
  step: number;
  isActive?: boolean;
  isCompleted?: boolean;
};

export default function StepNumber({
  step,
  isActive = false,
  isCompleted = false,
}: StepNumberProps) {
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
