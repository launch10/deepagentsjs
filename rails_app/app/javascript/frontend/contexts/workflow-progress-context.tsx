import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { workflow } from "@shared";
import type { ProgressStep } from "@components/header/header.types";

interface WorkflowProgressContextType {
  currentStepIndex: number;
  steps: ProgressStep[];
  setCurrentStepIndex: (index: number) => void;
}

const WorkflowProgressContext = createContext<WorkflowProgressContextType | undefined>(undefined);

export const useWorkflowProgress = () => {
  const context = useContext(WorkflowProgressContext);
  if (!context) {
    throw new Error("useWorkflowProgress must be used within WorkflowProgressProvider");
  }
  return context;
};

interface WorkflowProgressProviderProps {
  children: React.ReactNode;
  steps: ProgressStep[];
  initialStepIndex?: number;
}

export const WorkflowProgressProvider = ({
  children,
  steps,
  initialStepIndex,
}: WorkflowProgressProviderProps) => {
  const page = usePage();
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(() => {
    // If initialStepIndex is provided, use it
    if (initialStepIndex !== undefined) {
      return initialStepIndex;
    }

    // Try to determine from page props (workflow step)
    const props = page.props as Record<string, unknown>;
    if (props.workflow && typeof props.workflow === "object") {
      const workflow = props.workflow as { step?: string };
      if (workflow.step) {
        const stepIndex = steps.findIndex(
          (s) => s.label.toLowerCase().replace(/\s+/g, "_") === workflow.step?.toLowerCase()
        );
        if (stepIndex >= 0) {
          return stepIndex;
        }
      }
    }

    // Try to determine from URL pathname
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const workflowSteps = workflow.launch.steps.map((s) => s.name);

      // Check if URL contains step names
      for (let i = 0; i < workflowSteps.length; i++) {
        const stepName = workflowSteps[i];
        const stepLabel = steps.find(
          (s) => s.label.toLowerCase().replace(/\s+/g, "_") === stepName.toLowerCase()
        )?.label;

        if (stepLabel && pathname.toLowerCase().includes(stepName.toLowerCase())) {
          return i;
        }
      }
    }

    // Default to first step
    return 0;
  });

  // Update step index when URL or props change
  useEffect(() => {
    const props = page.props as Record<string, unknown>;
    if (props.workflow && typeof props.workflow === "object") {
      const workflow = props.workflow as { step?: string };
      if (workflow.step) {
        const stepIndex = steps.findIndex(
          (s) => s.label.toLowerCase().replace(/\s+/g, "_") === workflow.step?.toLowerCase()
        );
        if (stepIndex >= 0) {
          setCurrentStepIndex((prev) => (prev !== stepIndex ? stepIndex : prev));
        }
      }
    }
  }, [page.props, steps]);

  const value = useMemo(
    () => ({
      currentStepIndex,
      steps,
      setCurrentStepIndex,
    }),
    [currentStepIndex, steps]
  );

  return (
    <WorkflowProgressContext.Provider value={value}>{children}</WorkflowProgressContext.Provider>
  );
};
