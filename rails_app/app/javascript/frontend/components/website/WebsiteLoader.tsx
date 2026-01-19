import { cn } from "@lib/utils";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export interface WebsiteLoaderStep {
  id: string;
  label: string;
}

export interface WebsiteLoaderProps {
  title?: string;
  steps: WebsiteLoaderStep[];
  currentStep?: number;
  className?: string;
}

export default function WebsiteLoader({
  title = "Building your landing page",
  steps,
  currentStep = 0,
  className,
}: WebsiteLoaderProps) {
  const currentStepLabel = steps[currentStep]?.label ?? "";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="size-16 aspect-square">
        {/* TODO: Update LogoSpinner component for sizing? */}
        <DotLottieReact
          src="https://lottie.host/9ce95de1-701b-4d54-969c-772d52666454/EYWiURpiQr.lottie"
          loop
          autoplay
          layout={{
            fit: "none",
          }}
        />
      </div>
      <div className={cn("flex flex-col items-center gap-3", className)}>
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
