import Header from "@components/header/Header";
import MainSidebar from "@components/sidebar/MainSidebar";
import { usePage } from "@inertiajs/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkflowStepsProvider } from "@context/WorkflowStepsProvider";

const queryClient = new QueryClient();

export const SiteLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const { workflow, project } = usePage().props;

  return (
    <QueryClientProvider client={queryClient}>
      <WorkflowStepsProvider
        workflow={workflow as any}
        projectUUID={(project as any)?.uuid ?? null}
      >
        <div className="flex min-h-screen">
          <MainSidebar />
          <div className="flex-1 flex flex-col bg-background">
            <Header />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </WorkflowStepsProvider>
    </QueryClientProvider>
  );
};
