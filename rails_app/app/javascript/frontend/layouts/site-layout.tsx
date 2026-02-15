import { useEffect, useRef } from "react";
import Header from "@components/shared/header/Header";
import { AppSidebar } from "@components/navigation";
import { usePage } from "@inertiajs/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkflowProvider } from "@context/WorkflowProvider";
import { Toaster } from "@components/ui/sonner";
import { CreditWarningModal } from "@components/credits";
import { useJwtRefresh } from "@hooks/useJwtRefresh";
import {
  usePageHydration,
  useWebContainerWarmup,
  useFlashMessages,
  usePosthogIdentify,
} from "@hooks/layout";

const queryClient = new QueryClient();

// Type for flash messages from Rails
// Supports both simple messages and structured messages with title/description
export interface FlashMessage {
  type: "success" | "error" | "info";
  message?: string;
  title?: string;
  description?: string;
}

// Type for shared page props that all pages receive
export interface SharedPageProps {
  // Session/identity
  current_user?: { id: number; name: string; email: string };
  true_user?: { id: number; name: string; email: string };
  impersonating?: boolean;
  // API config
  jwt?: string;
  langgraph_path?: string;
  root_path?: string;
  // Project context
  project?: { id?: number; uuid?: string } | null;
  website?: { id?: number } | null;
  brainstorm?: { id?: number } | null;
  campaign?: { id?: number } | null;
  deploy?: { id?: number } | null;
  thread_id?: string;
  // Credits (values are in credits, not millicredits)
  credits?: {
    plan_credits: number;
    pack_credits: number;
    total_credits: number;
    plan_credits_allocated: number;
    period_ends_at: string | null;
  } | null;
  // Flash messages
  flash?: FlashMessage[];
}

export const SiteLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const { url } = usePage();
  const mainRef = useRef<HTMLElement>(null);

  usePageHydration();
  usePosthogIdentify();
  useJwtRefresh();
  useWebContainerWarmup();
  useFlashMessages();

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
        <Toaster position="top-right" />
        <CreditWarningModal />
      </WorkflowProvider>
    </QueryClientProvider>
  );
};
