import Header from "@components/header/header";
import { Workflow } from "@shared";
import { WorkflowProgressProvider } from "@contexts/workflow-progress-context";

export const SiteLayout = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode => {
  const prettifyStepName = (step: string) => {
    return step
      .replace("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };
  const steps = Workflow.getSteps("launch"); // TODO: Figure out better way to prettify step names
  const progressSteps = steps.map((step) => ({
    label: prettifyStepName(step),
    order: Workflow.getStepOrder("launch", step),
  }));
  return (
    <WorkflowProgressProvider steps={progressSteps}>
      <div className="bg-background min-h-screen">
        <Header />
        {children}
      </div>
    </WorkflowProgressProvider>
  );
};
