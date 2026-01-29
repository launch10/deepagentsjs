import { useEffect, useLayoutEffect, useRef } from "react";
import Header from "@components/shared/header/Header";
import { AppSidebar } from "@components/navigation";
import { usePage } from "@inertiajs/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkflowProvider } from "@context/WorkflowProvider";
import { Toaster } from "@components/ui/sonner";
import { toast } from "sonner";
import { CreditWarningModal } from "@components/credits";
import { useProjectStore } from "~/stores/projectStore";
import { useSessionStore } from "~/stores/sessionStore";
import { useCreditStore } from "~/stores/creditStore";

const queryClient = new QueryClient();

// Type for flash messages from Rails
// Supports both simple messages and structured messages with title/description
interface FlashMessage {
  type: "success" | "error" | "info";
  message?: string;
  title?: string;
  description?: string;
}

// Type for shared page props that all pages receive
interface SharedPageProps {
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
  const page = usePage();
  const url = page.url;
  const props = page.props as SharedPageProps;
  const mainRef = useRef<HTMLElement>(null);
  const lastUrlRef = useRef<string | null>(null);

  // Sync all page props to stores via useLayoutEffect (runs before paint, after DOM mutations).
  // This is the SINGLE place where we read from page props and populate stores.
  useLayoutEffect(() => {
    // 1. Session data (persists across navigation - no reset)
    useSessionStore.getState().hydrateFromPageProps({
      current_user: props.current_user,
      true_user: props.true_user,
      impersonating: props.impersonating,
      jwt: props.jwt,
      langgraph_path: props.langgraph_path,
      root_path: props.root_path,
    });

    // 2. Credits data (persists across navigation - no reset)
    // This ensures credit exhaustion state survives page transitions
    useCreditStore.getState().hydrateFromPageProps(props.credits ?? null);

    // 3. Project data (resets on URL change, then hydrates fresh)
    if (lastUrlRef.current !== null && lastUrlRef.current !== url) {
      useProjectStore.getState().reset();
    }
    useProjectStore.getState().setFromPageProps({
      project: props.project,
      website: props.website,
      brainstorm: props.brainstorm,
      campaign: props.campaign,
      thread_id: props.thread_id,
    });
    lastUrlRef.current = url;
  }, [url, props]);

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [url]);

  // Show flash messages as toasts
  useEffect(() => {
    if (props.flash && props.flash.length > 0) {
      props.flash.forEach((flash) => {
        // Support both simple messages and structured title/description
        const title = flash.title || flash.message;

        // Skip empty toasts
        if (!title) return;

        const options: { description?: string; duration?: number } = {
          duration: 5000, // Show for 5 seconds
        };
        if (flash.description) {
          options.description = flash.description;
        }

        switch (flash.type) {
          case "success":
            toast.success(title, options);
            break;
          case "error":
            toast.error(title, options);
            break;
          case "info":
            toast.info(title, options);
            break;
        }
      });
    }
  }, [props.flash]);

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
