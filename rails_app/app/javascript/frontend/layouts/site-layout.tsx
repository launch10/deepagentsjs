import Header from "@components/header/header";
import { workflow } from "@shared";
import { WorkflowProgressProvider } from "@contexts/workflow-progress-context";

export const SiteLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  return (
    <WorkflowProgressProvider steps={workflow.launch.steps}>
      <div className="bg-background min-h-screen">
        <Header />
        {children}
      </div>
    </WorkflowProgressProvider>
  );
};
