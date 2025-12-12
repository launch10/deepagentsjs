import { useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";
import { useWorkflowSteps, selectPageNumber, selectPages } from "@context/WorkflowStepsProvider";

type HeaderProgressStepperProps = {
  className?: string;
};

export default function HeaderProgressStepper({ className }: HeaderProgressStepperProps) {
  const pages = useWorkflowSteps(selectPages);
  const currentPageNumber = useWorkflowSteps(selectPageNumber);
  const activeLabelRef = useRef<HTMLSpanElement | null>(null);
  const [progressWidth, setProgressWidth] = useState(0);

  useEffect(() => {
    if (!activeLabelRef.current || currentPageNumber == null || !pages) return;
    if (currentPageNumber < pages.length - 1) {
      setProgressWidth(
        activeLabelRef.current.offsetWidth / 2 + activeLabelRef.current.offsetLeft + 8
      );
    } else {
      setProgressWidth(activeLabelRef.current.offsetWidth + activeLabelRef.current.offsetLeft);
    }
  }, [activeLabelRef.current, currentPageNumber, pages]);

  if (!pages || currentPageNumber == null) {
    return null;
  }

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
        {pages.map((page, index) => {
          const isCurrent = index === currentPageNumber;
          const isUpcoming = index > currentPageNumber;
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
              {page.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
