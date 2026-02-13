import type { Workflow } from "@shared";
import { useWorkflow, selectSubstep } from "@context/WorkflowProvider";
import BuildStep from "@components/website/steps/BuildStep";
import DomainStep from "@components/website/steps/DomainStep";
import DeployStep from "@components/website/steps/DeployStep";

const STEPS: Record<Exclude<Workflow.WebsiteSubstepName, "deploy">, React.ComponentType> = {
  build: BuildStep,
  domain: DomainStep,
};

export default function Website() {
  // Use workflow store for substep (like Campaign page does)
  // This allows pushState navigation without full page reload
  const substep = useWorkflow(selectSubstep) as Workflow.WebsiteSubstepName | null;

  // Deploy substep is now rendered by its own Deploy page via the controller.
  // If we somehow land here with deploy substep, show the placeholder.
  if (substep === "deploy") return <DeployStep />;

  const StepComponent = substep ? STEPS[substep] : null;
  return StepComponent ? <StepComponent /> : <BuildStep />;
}
