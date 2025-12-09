import HeaderUser from "./header-user";
import HeaderProgressStepper from "./header-progress-stepper";
import { Rocket } from "lucide-react";
import { useWorkflowProgress } from "@contexts/workflow-progress-context";
import { Workflow } from "@shared";

export default function Header() {
  const { steps, currentStepIndex } = useWorkflowProgress();
  return (
    <header className="bg-background p-5 border-b border-[#E2E1E0] mb-11 sticky top-0 z-10 h-20">
      <nav className="mx-auto flex container max-w-6xl justify-between">
        <span className="font-bold text-[#DF6D4A] flex items-center gap-2">
          <Rocket />
          Launch10
        </span>
        {steps && (
          <HeaderProgressStepper
            className="flex-1 mx-24"
            steps={steps}
            currentStepIndex={currentStepIndex}
          />
        )}
        <HeaderUser />
      </nav>
    </header>
  );
}
