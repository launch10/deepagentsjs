import { useEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import { AdminSidebar } from "@components/navigation";
import AdminHeader from "@components/shared/header/AdminHeader";
import { Toaster } from "@components/ui/sonner";

export const AdminLayout = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const { url } = usePage().props;
  const mainRef = useRef<HTMLElement>(null);

  // Scroll to top on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [url]);

  return (
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
  );
};
