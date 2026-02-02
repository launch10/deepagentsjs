import type { Workflow } from "@shared";
import { useWorkflow, selectSubstep } from "@context/WorkflowProvider";
import BuildStep from "./BuildStep";
import DomainStep from "./DomainStep";
import DeployStep from "./DeployStep";

const STEPS: Record<Workflow.WebsiteSubstepName, React.ComponentType> = {
  build: BuildStep,
  domain: DomainStep,
  deploy: DeployStep,
};

export default function WebsiteStep() {
  // Use workflow store for substep (like Campaign page does)
  // This allows pushState navigation without full page reload
  const substep = useWorkflow(selectSubstep) as Workflow.WebsiteSubstepName | null;
  const StepComponent = substep ? STEPS[substep] : null;
  return StepComponent ? <StepComponent /> : <BuildStep />;
}
