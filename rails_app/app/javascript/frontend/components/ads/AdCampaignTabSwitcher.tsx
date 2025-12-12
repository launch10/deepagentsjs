import { twMerge } from "tailwind-merge";
import { useWorkflowSteps, selectStep, selectSubstep, selectSetSubstep } from "@context/WorkflowStepsProvider";
import { Workflow } from "@shared"

export default function AdCampaignTabSwitcher() {
  const step = useWorkflowSteps(selectStep)
  const activeTab = useWorkflowSteps(selectSubstep) || "content";
  const setSubstep = useWorkflowSteps(selectSetSubstep);

  if (!step || !Workflow.isTabGroupName(step)) return null;

  const availableTabs = Workflow.findTabs(step);

  return (
    <div className="flex rounded-t-2xl border-neutral-300 border border-b-0 overflow-hidden">
      {availableTabs.map((tab) => (
        <button
          key={tab.order}
          type="button"
          onClick={() => setSubstep?.(tab.name)}
          className={twMerge(
            "flex-1 py-3 text-base-400 border-b border-b-neutral-300 bg-background",
            activeTab === tab.name && "border-b-yellow-700 text-base-600 bg-accent-yellow-100"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
