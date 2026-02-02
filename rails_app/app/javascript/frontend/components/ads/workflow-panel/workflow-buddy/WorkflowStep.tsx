import StepNumber from "./StepNumber";
import SubstepItem from "./SubstepItem";
import type { SubStepType } from "./workflow.types";

type WorkflowStepProps = {
  step: number;
  stepName: string;
  isActive?: boolean;
  isCompleted?: boolean;
  subSteps?: SubStepType[];
};

export default function WorkflowStep({
  step,
  stepName,
  isActive = false,
  isCompleted = false,
  subSteps,
}: WorkflowStepProps) {
  return (
    <div className="flex items-start gap-3">
      <StepNumber step={step} isActive={isActive} isCompleted={isCompleted} />
      <div className="flex flex-col gap-2">
        <span className={`text-sm ${isActive ? "text-base-600 font-medium" : "text-base-400"}`}>
          {stepName}
        </span>
        {subSteps && subSteps.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {subSteps.map((subStep) => (
              <SubstepItem key={subStep.label} subStep={subStep} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
