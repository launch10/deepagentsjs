import { CardTitle, CardDescription, CardHeader } from "@components/ui/card";
import WorkflowStep from "./workflow-buddy/WorkflowStep";
import { Workflow } from "@shared";
import { useWorkflow, selectStep, selectSubstep, selectPage } from "@context/WorkflowProvider";

export type WorkflowBuddyViewProps = {
  /** Current active page (brainstorm, website, ad_campaign, deploy) */
  activePage?: Workflow.WorkflowPage | null;
  /** Current active step (for nested workflows like ad_campaign) */
  activeStep?: string | null;
  /** Current active substep */
  activeSubstep?: string | null;
};

export function WorkflowBuddyView({
  activePage,
  activeStep,
  activeSubstep,
}: WorkflowBuddyViewProps) {
  // If no active page, don't render anything
  if (!activePage) return null;

  const step = Workflow.getStepForPage(activePage);
  if (!step) return null;

  const substepOrder = Workflow.getSubstepOrder(activePage);
  const substeps = step.steps;

  // For website workflow, we show flat steps (no nested substeps)
  // For ad_campaign, we show nested steps with substeps
  const isWebsiteWorkflow = activePage === "website";

  return (
    <CardHeader className="px-4 py-4">
      <CardTitle className="text-lg font-semibold font-serif">{step.title ?? step.label}</CardTitle>
      <CardDescription className="flex flex-col gap-[18px]">
        <div className="font-medium text-sm text-base-400">Steps</div>
        {substeps?.map((substep: Workflow.Step) => {
          if (isWebsiteWorkflow) {
            // Website workflow: flat steps, activeSubstep determines which step is active
            const isActive = substep.name === activeSubstep;
            const isCompleted = Workflow.isSubstepCompleted(
              substep.name,
              activeSubstep,
              substepOrder
            );

            return (
              <WorkflowStep
                key={substep.name}
                step={substep.order}
                stepName={substep.label}
                isActive={isActive}
                isCompleted={isCompleted}
              />
            );
          } else {
            // Ad campaign workflow: nested steps with substeps
            return (
              <WorkflowStep
                key={substep.name}
                step={substep.order}
                stepName={substep.label}
                isActive={substep.name === activeStep}
                subSteps={substep.steps?.map((nestedSubstep: Workflow.Step) => ({
                  label: nestedSubstep.label,
                  isSubStepActive: nestedSubstep.name === activeSubstep,
                  isSubStepCompleted: Workflow.isSubstepCompleted(
                    nestedSubstep.name,
                    activeSubstep,
                    substepOrder
                  ),
                }))}
              />
            );
          }
        })}
      </CardDescription>
    </CardHeader>
  );
}

export interface WorkflowBuddyProps {
  /** Override the active page (defaults to current page from workflow context) */
  workflowStep?: Workflow.WorkflowPage;
}

export default function WorkflowBuddy({ workflowStep }: WorkflowBuddyProps) {
  const currentPage = useWorkflow(selectPage);
  const activeStep = useWorkflow(selectStep);
  const activeSubstep = useWorkflow(selectSubstep);

  // Use override if provided, otherwise use current page from context
  const activePage = workflowStep ?? currentPage;

  return (
    <WorkflowBuddyView
      activePage={activePage}
      activeStep={activeStep}
      activeSubstep={activeSubstep}
    />
  );
}
