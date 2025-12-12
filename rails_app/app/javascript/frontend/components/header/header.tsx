import HeaderUser from "./header-user";
import HeaderProgressStepper from "./header-progress-stepper";
import { Rocket } from "lucide-react";
import { useWorkflowSteps, selectSteps } from "@context/WorkflowStepsProvider";

export default function Header({}) {
  const steps = useWorkflowSteps(selectSteps); // when we're not inside a provider, it will be undefined

  return (
    <header className="bg-background p-5 border-b border-[#E2E1E0] mb-11 sticky top-0 z-10 h-20">
      <nav className="mx-auto flex container max-w-6xl justify-between">
        <span className="font-bold text-[#DF6D4A] flex items-center gap-2">
          <Rocket />
          Launch10
        </span>
        {steps && <HeaderProgressStepper className="flex-1 mx-24" />}
        <HeaderUser />
      </nav>
    </header>
  );
}
