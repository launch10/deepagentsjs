import Header from "@components/header/header";
import { WorkflowProgressProvider } from "@contexts/workflow-progress-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export const SiteLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkflowProgressProvider>
        <div className="bg-background min-h-screen">
          <Header />
          {children}
        </div>
      </WorkflowProgressProvider>
    </QueryClientProvider>
  );
};
