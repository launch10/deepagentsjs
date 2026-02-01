import { CardTitle, CardDescription, CardHeader } from "@components/ui/card";
import WorkflowStep from "./workflow-buddy/WorkflowStep";
import { Workflow } from "@shared";
import { useWorkflow, selectStep, selectSubstep } from "@context/WorkflowProvider";

// ============================================================================
// Configuration
// ============================================================================

type WorkflowStepName = "website" | "ad_campaign";

interface WorkflowConfig {
  title: string;
  substepOrder: readonly string[];
  /** Optional label overrides for steps (key = step name from config) */
  labelOverrides?: Record<string, string>;
}

const workflowConfigs: Record<WorkflowStepName, WorkflowConfig> = {
  website: {
    title: "Landing Page Launch",
    substepOrder: Workflow.WebsiteSubstepNames,
    labelOverrides: {
      build: "Page Overview",
      domain: "Website Setup",
      deploy: "Launch",
    },
  },
  ad_campaign: {
    title: "Ad Campaign",
    substepOrder: Workflow.AdCampaignSubstepNames,
  },
};

function getStepsForWorkflow(stepName: WorkflowStepName): Workflow.Step[] | undefined {
  const step = Workflow.workflows.launch.steps.find((s) => s.name === stepName);
  if (step && "steps" in step) {
    return step.steps as Workflow.Step[];
  }
  return undefined;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Determines if a substep is completed based on the current active substep.
 * A substep is considered completed if it comes before the active substep in the order.
 */
function isSubStepCompleted(
  substepName: string,
  activeSubstep: string | null | undefined,
  substepOrder: readonly string[]
): boolean {
  if (!activeSubstep) return false;

  const currentIndex = substepOrder.indexOf(activeSubstep);
  const substepIndex = substepOrder.indexOf(substepName);

  // If either index is -1 (not found), return false
  if (currentIndex === -1 || substepIndex === -1) return false;

  // A substep is completed if it comes before the current active substep
  return substepIndex < currentIndex;
}

/**
 * Get the display label for a step, applying any overrides
 */
function getStepLabel(
  stepName: string,
  defaultLabel: string,
  labelOverrides?: Record<string, string>
): string {
  return labelOverrides?.[stepName] ?? defaultLabel;
}

// ============================================================================
// Components
// ============================================================================

export type WorkflowBuddyViewProps = {
  /** Which workflow step to display (website or ad_campaign) */
  workflowStep?: WorkflowStepName;
  activeStep?: string | null;
  activeSubstep?: string | null;
};

export function WorkflowBuddyView({
  workflowStep = "ad_campaign",
  activeStep,
  activeSubstep,
}: WorkflowBuddyViewProps) {
  const config = workflowConfigs[workflowStep];
  const steps = getStepsForWorkflow(workflowStep);

  // For website workflow, we show flat steps (no nested substeps)
  // For ad_campaign, we show nested steps with substeps
  const isWebsiteWorkflow = workflowStep === "website";

  return (
    <CardHeader className="px-4 py-4">
      <CardTitle className="text-lg font-semibold font-serif">{config.title}</CardTitle>
      <CardDescription className="flex flex-col gap-[18px]">
        <div className="font-medium text-sm text-base-400">Steps</div>
        {steps?.map((step: Workflow.Step) => {
          const stepLabel = getStepLabel(step.name, step.label, config.labelOverrides);

          if (isWebsiteWorkflow) {
            // Website workflow: flat steps, activeSubstep determines which step is active
            const isActive = step.name === activeSubstep;
            const isCompleted = isSubStepCompleted(step.name, activeSubstep, config.substepOrder);

            return (
              <WorkflowStep
                key={step.name}
                step={step.order}
                stepName={stepLabel}
                isActive={isActive}
                isCompleted={isCompleted}
              />
            );
          } else {
            // Ad campaign workflow: nested steps with substeps
            return (
              <WorkflowStep
                key={step.name}
                step={step.order}
                stepName={stepLabel}
                isActive={step.name === activeStep}
                subSteps={step.steps?.map((subStep: Workflow.Step) => ({
                  label: getStepLabel(subStep.name, subStep.label, config.labelOverrides),
                  isSubStepActive: subStep.name === activeSubstep,
                  isSubStepCompleted: isSubStepCompleted(
                    subStep.name,
                    activeSubstep,
                    config.substepOrder
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
  /** Which workflow step to display (website or ad_campaign). Defaults to ad_campaign. */
  workflowStep?: WorkflowStepName;
}

export default function WorkflowBuddy({ workflowStep = "ad_campaign" }: WorkflowBuddyProps) {
  const activeStep = useWorkflow(selectStep);
  const activeSubstep = useWorkflow(selectSubstep);

  return (
    <WorkflowBuddyView
      workflowStep={workflowStep}
      activeStep={activeStep}
      activeSubstep={activeSubstep}
    />
  );
}
