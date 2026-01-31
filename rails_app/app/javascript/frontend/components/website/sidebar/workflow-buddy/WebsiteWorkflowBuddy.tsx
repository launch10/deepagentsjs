import { CardTitle, CardDescription, CardHeader } from "@components/ui/card";
import { Workflow } from "@shared";
import { WebsiteWorkflowStep } from "./WebsiteWorkflowStep";

// Website steps with labels matching the Figma design
const websiteSteps = [
  { name: "build", label: "Page Overview", order: 1 },
  { name: "domain", label: "Website Setup", order: 2 },
  { name: "deploy", label: "Launch", order: 3 },
] as const;

export type WebsiteWorkflowBuddyViewProps = {
  activeSubstep?: Workflow.WebsiteSubstepName | null;
};

/**
 * Determines if a substep is completed based on the current active substep.
 * A substep is considered completed if it comes before the active substep in the order.
 */
function isSubStepCompleted(
  substepName: string,
  activeSubstep: string | null | undefined
): boolean {
  if (!activeSubstep) return false;

  const substepOrder = Workflow.WebsiteSubstepNames;
  const currentIndex = substepOrder.indexOf(activeSubstep as Workflow.WebsiteSubstepName);
  const substepIndex = substepOrder.indexOf(substepName as Workflow.WebsiteSubstepName);

  // If either index is -1 (not found), return false
  if (currentIndex === -1 || substepIndex === -1) return false;

  // A substep is completed if it comes before the current active substep
  return substepIndex < currentIndex;
}

export function WebsiteWorkflowBuddyView({ activeSubstep }: WebsiteWorkflowBuddyViewProps) {
  return (
    <CardHeader className="px-4 py-4">
      <CardTitle className="text-lg font-semibold font-serif">Landing Page Launch</CardTitle>
      <CardDescription className="flex flex-col gap-[18px]">
        <div className="font-medium text-sm text-base-400">Steps</div>
        {websiteSteps.map((step) => (
          <WebsiteWorkflowStep
            key={step.name}
            step={step.order}
            stepName={step.label}
            isActive={step.name === activeSubstep}
            isCompleted={isSubStepCompleted(step.name, activeSubstep)}
          />
        ))}
      </CardDescription>
    </CardHeader>
  );
}

export interface WebsiteWorkflowBuddyProps {
  substep?: Workflow.WebsiteSubstepName | null;
}

export function WebsiteWorkflowBuddy({ substep }: WebsiteWorkflowBuddyProps) {
  return <WebsiteWorkflowBuddyView activeSubstep={substep} />;
}
