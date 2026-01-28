import { useEffect, useLayoutEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminSidebar } from "@components/navigation";
import AdminHeader from "@components/shared/header/AdminHeader";
import { Toaster } from "@components/ui/sonner";
import { useSessionStore } from "~/stores/sessionStore";

const queryClient = new QueryClient();

// Type for shared page props that all pages receive
interface SharedPageProps {
  current_user?: { id: number; name: string; email: string };
  true_user?: { id: number; name: string; email: string };
  impersonating?: boolean;
}

export const AdminLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const page = usePage();
  const url = page.url;
  const props = page.props as SharedPageProps;
  const mainRef = useRef<HTMLElement>(null);

  // Sync session data to store via useLayoutEffect (runs before paint, after DOM mutations).
  // This is the SINGLE place where admin pages read from page props and populate stores.
  useLayoutEffect(() => {
    useSessionStore.getState().hydrateFromPageProps({
      current_user: props.current_user,
      true_user: props.true_user,
      impersonating: props.impersonating,
    });
  }, [props]);

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [url]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex h-screen overflow-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          <AdminHeader />
          <main ref={mainRef} className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
};
