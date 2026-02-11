import { cn } from "@lib/utils";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export interface StepProgressStep {
  id: string;
  label: string;
}

export interface StepProgressProps {
  title: string;
  subtitle?: string;
  steps: StepProgressStep[];
  currentStep: number;
  className?: string;
}

export function StepProgress({
  title,
  subtitle,
  steps,
  currentStep,
  className,
}: StepProgressProps) {
  const currentStepLabel = subtitle ?? steps[currentStep]?.label ?? "";

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="size-16 aspect-square">
        <DotLottieReact
          src="https://lottie.host/9ce95de1-701b-4d54-969c-772d52666454/EYWiURpiQr.lottie"
          loop
          autoplay
          layout={{ fit: "none" }}
        />
      </div>
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-col items-center">
          <p className="text-sm font-medium text-base-500 leading-[18px]">{title}</p>
          <p className="text-xs text-base-400 leading-4 mt-[7px]">{currentStepLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "size-2 rounded-full transition-colors",
                index < currentStep && "bg-success-400",
                index === currentStep && "bg-neutral-500",
                index > currentStep && "bg-neutral-200"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
