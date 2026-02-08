import type { Workflow } from "@shared";
import { useWorkflow, selectSubstep } from "@context/WorkflowProvider";
import BuildStep from "@components/website/steps/BuildStep";
import DomainStep from "@components/website/steps/DomainStep";
import DeployStep from "@components/website/steps/DeployStep";

const STEPS: Record<Workflow.WebsiteSubstepName, React.ComponentType> = {
  build: BuildStep,
  domain: DomainStep,
  deploy: DeployStep,
};

export default function Website() {
  // Use workflow store for substep (like Campaign page does)
  // This allows pushState navigation without full page reload
  const substep = useWorkflow(selectSubstep) as Workflow.WebsiteSubstepName | null;
  const StepComponent = substep ? STEPS[substep] : null;
  return StepComponent ? <StepComponent /> : <BuildStep />;
}
