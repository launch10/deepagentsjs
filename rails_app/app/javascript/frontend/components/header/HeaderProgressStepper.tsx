import { useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useWorkflowOptional, selectPageNumber, selectPages } from "@context/WorkflowProvider";
import { Workflow } from "@shared";

export type HeaderProgressStepperViewProps = {
  steps: readonly Workflow.Step[] | { label: string }[];
  currentStepIndex: number;
  className?: string;
};

export function HeaderProgressStepperView({ steps, currentStepIndex, className }: HeaderProgressStepperViewProps) {
  const activeLabelRef = useRef<HTMLSpanElement | null>(null);
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    if (!activeLabelRef.current) return;
    if (currentStepIndex < steps.length - 1) {
      setProgressWidth(
        activeLabelRef.current.offsetWidth / 2 + activeLabelRef.current.offsetLeft + 8
      );
    } else {
      setProgressWidth(activeLabelRef.current.offsetWidth + activeLabelRef.current.offsetLeft);
    }
  }, [activeLabelRef.current, currentStepIndex, steps]);

  return (
    <div className={twMerge("w-full", className)} data-testid="workflow-progress-stepper">
      <div className="bg-[#EDEDEC] relative h-2 w-full rounded-full">
        <div
          className="absolute top-0 left-0 h-2 bg-linear-to-r from-[#7F8CDF] to-[#3748B8] rounded-full"
          style={{
            width: `${progressWidth}px`,
          }}
        >
          <div className="size-[14px] bg-[#3748B8] rounded-full -top-[3px] right-0 absolute" />
        </div>
      </div>
      <div className="flex justify-between mt-2 relative">
        {steps.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isUpcoming = index > currentStepIndex;
          return (
            <span
              key={index}
              className={twMerge(
                "text-xs text-base-500",
                isCurrent && "font-semibold",
                isUpcoming && "text-base-300"
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

type HeaderProgressStepperProps = {
  className?: string;
};

export default function HeaderProgressStepper({ className }: HeaderProgressStepperProps) {
  const pages = useWorkflowOptional(selectPages);
  const currentPageNumber = useWorkflowOptional(selectPageNumber);

  // Show the stepper if we have a valid workflow page (pageNumber >= 0)
  // The store derives from URL, so pageNumber is -1 when not on a workflow URL.
  const hasValidPage = currentPageNumber != null && currentPageNumber >= 0;

  // Show stepper only if we have a valid page in the workflow store
  const shouldShow = hasValidPage;

  if (!pages || currentPageNumber == null || !shouldShow) {
    return null;
  }

  return (
    <HeaderProgressStepperView
      steps={pages}
      currentStepIndex={currentPageNumber}
      className={className}
    />
  );
}
