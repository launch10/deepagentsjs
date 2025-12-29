import Header from "@components/header/Header";
import MainSidebar from "@components/sidebar/MainSidebar";
import { usePage } from "@inertiajs/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkflowStepsProvider } from "@context/WorkflowStepsProvider";

const queryClient = new QueryClient();

export const SiteLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const { workflow, project, url } = usePage().props;
  const currentUrl = usePage().url;

  // Show progress stepper on brainstorm pages that have a project (conversation started)
  // but not on the initial empty state (root "/" or "/projects/new")
  const isEmptyBrainstormPage = currentUrl === "/" || currentUrl === "/projects/new";
  const isBrainstormWithProject = currentUrl.includes("/brainstorm") && (project as any)?.uuid;

  // Auto-collapse sidebar when on brainstorm page with a project (chat mode)
  const shouldCollapseSidebar = isBrainstormWithProject;

  return (
    <QueryClientProvider client={queryClient}>
      <WorkflowStepsProvider
        workflow={workflow as any}
        projectUUID={(project as any)?.uuid ?? null}
      >
        <div className="flex min-h-screen">
          <MainSidebar defaultCollapsed={shouldCollapseSidebar} />
          <div className="flex-1 flex flex-col bg-background">
            <Header showProgressStepper={!isEmptyBrainstormPage} />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </WorkflowStepsProvider>
    </QueryClientProvider>
  );
};
