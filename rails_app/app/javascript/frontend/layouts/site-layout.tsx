import Header from "@components/Header/Header";
import { usePage } from "@inertiajs/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  WorkflowStepsProvider,
} from "@context/WorkflowStepsProvider";

const queryClient = new QueryClient();

export const SiteLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const { workflow, project } = usePage().props;

  return (
    <QueryClientProvider client={queryClient}>
      <WorkflowStepsProvider workflow={workflow as any} projectUUID={(project as any)?.uuid ?? null}>
        <div className="bg-background min-h-screen">
          <Header />
          {children}
        </div>
      </WorkflowStepsProvider>
    </QueryClientProvider>
  );
};
