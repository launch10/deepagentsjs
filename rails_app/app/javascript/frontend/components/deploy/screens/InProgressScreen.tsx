import { useMemo } from "react";
import { StepProgress } from "@components/ui/step-progress";
import { Deploy } from "@shared";
import { useDeployChatState } from "@hooks/useDeployChat";
import { useDeployInstructions } from "@hooks/useDeployInstructions";

const fallbackSteps = [{ id: "preparing", label: "Preparing deployment" }];

interface InProgressScreenProps {
  /** Override instructions for stories/tests where usePage() isn't available */
  instructions?: Deploy.Instructions;
}

export default function InProgressScreen({
  instructions: instructionsProp,
}: InProgressScreenProps) {
  const hookInstructions = useDeployInstructions();
  const instructions = instructionsProp ?? hookInstructions;
  const tasks = useDeployChatState("tasks");
  const noun = instructions.googleAds ? "website & campaign" : "website";

  const { steps, currentStep, subtitle, warning } = useMemo(() => {
    // Filter to only tasks relevant to current instructions
    const relevantNames = Deploy.findTasks(instructions);
    const filtered = (tasks ?? []).filter((t) => relevantNames.includes(t.name as Deploy.TaskName));

    if (filtered.length === 0) {
      return {
        steps: fallbackSteps,
        currentStep: 0,
        subtitle: undefined as string | undefined,
        warning: undefined as string | undefined,
      };
    }

    const isTerminal = (status: string) =>
      status === "completed" || status === "skipped" || status === "passed";
    const completedCount = filtered.filter((t) => isTerminal(t.status)).length;

    const running = filtered.filter((t) => t.status === "running");
    let label: string | undefined;
    if (running.length === 1) {
      label = Deploy.TaskDescriptionMap[running[0].name as Deploy.TaskName] ?? running[0].name;
    } else if (running.length > 1) {
      const first =
        Deploy.TaskDescriptionMap[running[0].name as Deploy.TaskName] ?? running[0].name;
      label = `${first} + ${running.length - 1} other task${running.length - 1 > 1 ? "s" : ""}`;
    }

    return {
      steps: filtered.map((t) => ({
        id: t.name,
        label: Deploy.TaskDescriptionMap[t.name as Deploy.TaskName] ?? t.name,
      })),
      currentStep: completedCount,
      subtitle: label,
      warning: filtered.find((t) => t.warning)?.warning,
    };
  }, [tasks, instructions]);

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
