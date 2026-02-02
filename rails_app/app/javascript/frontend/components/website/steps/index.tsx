import { usePage } from "@inertiajs/react";
import type { Workflow } from "@shared";
import BuildStep from "./BuildStep";
import DomainStep from "./DomainStep";
import DeployStep from "./DeployStep";

interface WebsitePageProps {
  substep?: Workflow.WebsiteSubstepName;
  [key: string]: unknown;
}

const STEPS: Record<Workflow.WebsiteSubstepName, React.ComponentType> = {
  build: BuildStep,
  domain: DomainStep,
  deploy: DeployStep,
};

export default function WebsiteStep() {
  const { substep = "build" } = usePage<WebsitePageProps>().props;
  const StepComponent = STEPS[substep];
  return StepComponent ? <StepComponent /> : <BuildStep />;
}

export { WebsitePaginationFooter } from "./WebsitePaginationFooter";
