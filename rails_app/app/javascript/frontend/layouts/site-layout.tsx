import { useEffect, useRef } from "react";
import Header from "@components/shared/header/Header";
import { AppSidebar } from "@components/navigation";
import { usePage } from "@inertiajs/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkflowProvider } from "@context/WorkflowProvider";
import { Toaster } from "@components/ui/sonner";

const queryClient = new QueryClient();

export const SiteLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const { url } = usePage().props;
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [url]);

  return (
    <QueryClientProvider client={queryClient}>
      <WorkflowProvider>
        <div className="flex h-screen overflow-hidden">
          <AppSidebar />
          <div className="flex-1 flex flex-col bg-background overflow-hidden">
            <Header />
            <main ref={mainRef} className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </WorkflowProvider>
    </QueryClientProvider>
  );
};
