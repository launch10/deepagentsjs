import { useMemo } from "react";
import { StepProgress } from "@components/ui/step-progress";
import { Deploy } from "@shared";
import { useDeployChatState } from "@hooks/useDeployChat";

const CAMPAIGN_TASK_NAMES: string[] = [
  "ConnectingGoogle",
  "VerifyingGoogle",
  "CheckingBilling",
  "DeployingCampaign",
  "EnablingCampaign",
];

const fallbackSteps = [{ id: "preparing", label: "Preparing deployment" }];

export default function InProgressScreen() {
  const tasks = useDeployChatState("tasks");

  const { steps, currentStep, subtitle, warning, hasCampaignTasks } = useMemo(() => {
    const allTasks = tasks ?? [];

    if (allTasks.length === 0) {
      return {
        steps: fallbackSteps,
        currentStep: 0,
        subtitle: undefined as string | undefined,
        warning: undefined as string | undefined,
        hasCampaignTasks: false,
      };
    }

    const isTerminal = (status: string) =>
      status === "completed" || status === "skipped" || status === "passed";
    const completedCount = allTasks.filter((t) => isTerminal(t.status)).length;

    const running = allTasks.filter((t) => t.status === "running");
    let label: string | undefined;
    if (running.length === 1) {
      label = Deploy.TaskDescriptionMap[running[0].name as Deploy.TaskName] ?? running[0].name;
    } else if (running.length > 1) {
      const first =
        Deploy.TaskDescriptionMap[running[0].name as Deploy.TaskName] ?? running[0].name;
      label = `${first} + ${running.length - 1} other task${running.length - 1 > 1 ? "s" : ""}`;
    }

    return {
      steps: allTasks.map((t) => ({
        id: t.name,
        label: Deploy.TaskDescriptionMap[t.name as Deploy.TaskName] ?? t.name,
      })),
      currentStep: completedCount,
      subtitle: label,
      warning: allTasks.find((t) => t.warning)?.warning,
      hasCampaignTasks: allTasks.some((t) => CAMPAIGN_TASK_NAMES.includes(t.name)),
    };
  }, [tasks]);

  const noun = hasCampaignTasks ? "website & campaign" : "website";

  return (
    <div className="flex flex-col items-center justify-center p-12 h-full">
      <StepProgress
        title={`Launching your ${noun}`}
        subtitle={subtitle}
        steps={steps}
        currentStep={currentStep}
      />
      {warning && (
        <div className="mt-6 max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center">
          <p className="text-sm text-amber-800">{warning}</p>
        </div>
      )}
    </div>
  );
}
