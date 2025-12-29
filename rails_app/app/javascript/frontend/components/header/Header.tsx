import HeaderUser from "./HeaderUser";
import HeaderProgressStepper from "./HeaderProgressStepper";
import { useWorkflowSteps, selectPages } from "@context/WorkflowStepsProvider";

interface HeaderProps {
  showProgressStepper?: boolean;
}

export default function Header({ showProgressStepper = true }: HeaderProps) {
  const pages = useWorkflowSteps(selectPages); // when we're not inside a provider, it will be undefined

  return (
    <header className="bg-background py-5 px-6 sticky top-0 z-10">
      <nav className="flex justify-between items-center">
        <img src="/images/launch10-logo.svg" alt="Launch10" className="h-8" />
        {showProgressStepper && pages && <HeaderProgressStepper className="flex-1 mx-24" />}
        <HeaderUser />
      </nav>
    </header>
  );
}
