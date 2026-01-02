import { twMerge } from "tailwind-merge";
import {
  useWorkflow,
  selectStep,
  selectSubstep,
  selectSetSubstep,
  selectCanGoBack,
} from "@context/WorkflowProvider";
import { useFormRegistry, selectValidate } from "@stores/formRegistry";
import { Workflow } from "@shared";

export default function AdCampaignTabSwitcher({ disabled }: { disabled?: boolean }) {
  const validateForm = useFormRegistry(selectValidate);
  const step = useWorkflow(selectStep);
  const activeTab = useWorkflow(selectSubstep) || "content";
  const setSubstep = useWorkflow(selectSetSubstep);
  const canGoBack = useWorkflow(selectCanGoBack);

  if (!step || !Workflow.isTabGroupName(step)) return null;

  const availableSubsteps = Workflow.findTabs(step);

  const setActiveTab = async (tabName: Workflow.SubstepName) => {
    const selectedTabIsGreaterThanCurrentTab =
      availableSubsteps.findIndex((substep) => substep.name === tabName) >
      availableSubsteps.findIndex((substep) => substep.name === activeTab);

    // You're allowed to go back to previous tabs, but not forward without validating
    if (selectedTabIsGreaterThanCurrentTab) {
      const isValid = await validateForm(step);
      if (!isValid) return;
    }

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
            "flex-1 py-2 text-sm text-base-400 border-b-2 border-b-neutral-300 bg-background",
            activeTab === substep.name &&
              "border-b-accent-yellow-700 text-accent-yellow-800 bg-accent-yellow-100"
          )}
          disabled={!canGoBack || disabled}
        >
          {substep.label}
        </button>
      ))}
    </div>
  );
}
