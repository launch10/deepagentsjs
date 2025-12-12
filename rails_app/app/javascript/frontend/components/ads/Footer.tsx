import { Button } from "@components/ui/button";
import { twMerge } from "tailwind-merge";
import { useFormRegistry, selectValidateParent } from "@stores/formRegistry";
import {
  useWorkflowSteps,
  selectSubstep,
  selectContinue,
  selectBack,
  selectCanGoBack,
} from "@context/WorkflowStepsProvider";

interface FooterProps {
  className?: string;
}

export default function Footer({ className }: FooterProps) {
  const validateParent = useFormRegistry(selectValidateParent);

  const substep = useWorkflowSteps(selectSubstep);
  const workflowContinue = useWorkflowSteps(selectContinue);
  const workflowBack = useWorkflowSteps(selectBack);
  const canGoBack = useWorkflowSteps(selectCanGoBack);

  const handleContinue = async () => {
    if (!substep) return;

    const isValid = await validateParent(substep);
    if (!isValid) return;

    workflowContinue();
  };

  const handleBack = () => {
    workflowBack();
  };

  return (
    <div
      className={twMerge(
        "sticky bottom-0 mt-3",
        "bg-background flex justify-between items-center border-t border-neutral-200 py-4 px-6 shadow-[9px_-16px_26.1px_1px_#74767A12]",
        className
      )}
    >
      <Button variant="link" onClick={handleBack} disabled={!canGoBack()}>
        Previous Step
      </Button>
      <Button onClick={handleContinue}>Continue</Button>
    </div>
  );
}
