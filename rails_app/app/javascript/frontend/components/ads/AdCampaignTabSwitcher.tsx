import { twMerge } from "tailwind-merge";
import { useWorkflowSteps, selectStep, selectSubstep, selectSetSubstep } from "@context/WorkflowStepsProvider";
import { useFormRegistry, selectValidate } from "@stores/formRegistry";
import { Workflow } from "@shared"

export default function AdCampaignTabSwitcher() {
  const validateForm = useFormRegistry(selectValidate);
  const step = useWorkflowSteps(selectStep)
  const activeTab = useWorkflowSteps(selectSubstep) || "content";
  const setSubstep = useWorkflowSteps(selectSetSubstep)!;

  if (!step || !Workflow.isTabGroupName(step)) return null;

  const availableSubsteps = Workflow.findTabs(step);

  const setActiveTab = async (tabName: Workflow.SubstepName) => {
    const isValid = await validateForm(step);
    if (!isValid) return;

    setSubstep(tabName);
  };

  return (
    <div className="flex rounded-t-2xl border-neutral-300 border border-b-0 overflow-hidden">
      {availableSubsteps.map((substep) => (
        <button
          key={substep.order}
          type="button"
          onClick={() => setActiveTab(substep.name)} 
          className={twMerge(
            "flex-1 py-3 text-base-400 border-b border-b-neutral-300 bg-background",
            activeTab === substep.name && "border-b-yellow-700 text-base-600 bg-accent-yellow-100"
          )}
        >
          {substep.label}
        </button>
      ))}
    </div>
  );
}
