import { useMemo } from "react";
import { useWebsiteChatState } from "@hooks/website";
import { StepProgress } from "@components/ui/step-progress";

const fallbackSteps = [{ id: "1", label: "Setting up branding & colors" }];

/**
 * Self-contained loader for the initial website build.
 * Reads todos from the chat store and derives its own progress state.
 */
export default function WebsiteLoader({ className }: { className?: string }) {
  const todos = useWebsiteChatState("todos");

  const { steps, currentStep, subtitle } = useMemo(() => {
    if (!todos || todos.length === 0) {
      return { steps: fallbackSteps, currentStep: 0, subtitle: undefined as string | undefined };
    }

    const inProgress = todos.filter((t) => t.status === "in_progress");
    const completedCount = todos.filter((t) => t.status === "completed").length;

    let label: string | undefined;
    if (inProgress.length === 1) {
      label = inProgress[0].content;
    } else if (inProgress.length > 1) {
      label = `${inProgress[0].content} + ${inProgress.length - 1} other task${inProgress.length - 1 > 1 ? "s" : ""}`;
    }

    return {
      steps: todos.map((t) => ({ id: t.id ?? t.content, label: t.content })),
      currentStep: completedCount,
      subtitle: label,
    };
  }, [todos]);

  return (
    <StepProgress
      title="Building your landing page"
      subtitle={subtitle}
      steps={steps}
      currentStep={currentStep}
      className={className}
    />
  );
}
