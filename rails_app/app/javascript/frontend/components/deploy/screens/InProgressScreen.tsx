import { useMemo } from "react";
import { StepProgress } from "@components/ui/step-progress";
import { Deploy } from "@shared";

type GraphTask = NonNullable<Deploy.DeployGraphState["tasks"]>[number];

interface InProgressScreenProps {
  deployType: "website" | "campaign";
  tasks?: GraphTask[];
  isStuck?: boolean;
}

const fallbackSteps = [{ id: "preparing", label: "Preparing deployment" }];

export default function InProgressScreen({ deployType, tasks, isStuck }: InProgressScreenProps) {
  const noun = deployType === "campaign" ? "website & campaign" : "website";

  const { steps, currentStep, subtitle } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return { steps: fallbackSteps, currentStep: 0, subtitle: undefined as string | undefined };
    }

    const isTerminal = (status: string) =>
      status === "completed" || status === "skipped" || status === "passed";
    const completedCount = tasks.filter((t) => isTerminal(t.status)).length;

    const running = tasks.filter((t) => t.status === "running");
    let label: string | undefined;
    if (running.length === 1) {
      label = Deploy.TaskDescriptionMap[running[0].name as Deploy.TaskName] ?? running[0].name;
    } else if (running.length > 1) {
      const first =
        Deploy.TaskDescriptionMap[running[0].name as Deploy.TaskName] ?? running[0].name;
      label = `${first} + ${running.length - 1} other task${running.length - 1 > 1 ? "s" : ""}`;
    }

    return {
      steps: tasks.map((t) => ({
        id: t.name,
        label: Deploy.TaskDescriptionMap[t.name as Deploy.TaskName] ?? t.name,
      })),
      currentStep: completedCount,
      subtitle: label,
    };
  }, [tasks]);

  return (
    <div className="flex flex-col items-center justify-center p-12 h-full">
      <StepProgress
        title={`Launching your ${noun}`}
        subtitle={subtitle}
        steps={steps}
        currentStep={currentStep}
      />
      {isStuck && (
        <div className="mt-6 max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center">
          <p className="text-sm text-amber-800">
            This is taking longer than expected. Your deployment is still in progress.
          </p>
        </div>
      )}
    </div>
  );
}
