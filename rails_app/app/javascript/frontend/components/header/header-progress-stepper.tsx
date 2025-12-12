import { useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useWorkflowSteps, selectStepNumber, selectSteps } from "@context/WorkflowStepsProvider";

type HeaderProgressStepperProps = {
  className?: string;
};

export default function HeaderProgressStepper({ className }: HeaderProgressStepperProps) {
  const steps = useWorkflowSteps(selectSteps);
  const currentStepNumber = useWorkflowSteps(selectStepNumber);
  if (!steps || !currentStepNumber) {
    return;
  }

  const activeLabelRef = useRef<HTMLSpanElement | null>(null);
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    if (!activeLabelRef.current) return;
    if (currentStepNumber < steps.length - 1) {
      // Steps align to middle of text
      setProgressWidth(
        activeLabelRef.current.offsetWidth / 2 + activeLabelRef.current.offsetLeft + 8
      );
    } else {
      // Last step alignts to end of bar
      setProgressWidth(activeLabelRef.current.offsetWidth + activeLabelRef.current.offsetLeft);
    }
  }, [activeLabelRef.current]);

  return (
    <div className={twMerge("w-full", className)}>
      <div className="bg-[#EDEDEC] relative h-2 w-full rounded-full">
        <div
          className="absolute top-0 left-0 h-2 bg-linear-to-r from-[#7F8CDF] to-[#3748B8] rounded-full"
          style={{
            width: `${progressWidth}px`,
          }}
        >
          <div className="size-4 bg-[#3748B8] rounded-full -top-[50%] right-0 absolute" />
        </div>
      </div>
      <div className="flex justify-between mt-2 relative">
        {steps.map((step, index) => {
          const isCurrent = index === currentStepNumber;
          const isUpcoming = index > currentStepNumber;
          return (
            <span
              key={index}
              className={twMerge(
                "text-sm text-primary",
                isCurrent && "font-semibold",
                isUpcoming && "text-gray-500"
              )}
              ref={(el) => {
                if (isCurrent) {
                  activeLabelRef.current = el;
                }
              }}
            >
              {step.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
