import { useEffect, useRef } from "react";
import Header from "@components/shared/header/Header";
import { AppSidebar } from "@components/navigation";
import { usePage } from "@inertiajs/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkflowProvider } from "@context/WorkflowProvider";
import { Toaster } from "@components/ui/sonner";
import { useCoreEntityStore } from "~/stores/coreEntityStore";

const queryClient = new QueryClient();

export const SiteLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const page = usePage();
  const url = page.url; // Use Inertia's standard URL property, not props.url
  const mainRef = useRef<HTMLElement>(null);
  const lastUrlRef = useRef<string | null>(null);

  // Reset core entity store when URL changes.
  // This runs synchronously during render (before children render),
  // ensuring the store is clean before page components hydrate it.
  if (lastUrlRef.current !== null && lastUrlRef.current !== url) {
    useCoreEntityStore.getState().reset();
  }
  lastUrlRef.current = url;

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
