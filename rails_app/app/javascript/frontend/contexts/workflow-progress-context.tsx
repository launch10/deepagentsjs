import type { ProgressStep } from "@components/header/header.types";
import type { PageProps } from "@inertiajs/core";
import { usePage } from "@inertiajs/react";
import { Workflow } from "@shared";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
  initialStepIndex?: number;
}

const getStepsFromProps = (pageProps: PageProps): ProgressStep[] => {
  const workflow = Workflow.Workflow["workflow"];
  const workflowType = ((pageProps.workflow as { workflow_type?: string })?.workflow_type ||
    "launch") as keyof typeof workflow;
  const configSteps = workflow[workflowType]?.steps;
  return (
    configSteps?.map((step) => ({ label: step.label, order: step.order })) ||
    workflow.launch.steps.map((step) => ({
      label: step.label,
      order: step.order,
    }))
  );
};

const findStepIndex = (steps: ProgressStep[], stepName: string): number => {
  return steps.findIndex(
    (s) => s.label.toLowerCase().replace(/\s+/g, "_") === stepName.toLowerCase()
  );
};

export const WorkflowProgressProvider = ({
  children,
  initialStepIndex = 0,
}: WorkflowProgressProviderProps) => {
  const page = usePage();
  const props = page.props;
  console.log({ props });
  const workflowObj = props.workflow as { workflow_type?: string; step?: string } | undefined;
  const steps = useMemo(() => getStepsFromProps(props), [props]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(initialStepIndex);

  useEffect(() => {
    if (workflowObj?.step) {
      const index = findStepIndex(steps, workflowObj.step);
      if (index >= 0) setCurrentStepIndex(index);
    }
  }, [workflowObj?.step]);

  const value = useMemo(
    () => ({ currentStepIndex, steps, setCurrentStepIndex }),
    [currentStepIndex, steps]
  );

  return (
    <WorkflowProgressContext.Provider value={value}>{children}</WorkflowProgressContext.Provider>
  );
};
