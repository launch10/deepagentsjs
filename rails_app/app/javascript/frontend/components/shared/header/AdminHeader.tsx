import { usePage } from "@inertiajs/react";
import { CircleUserIcon } from "lucide-react";
import ImpersonationBanner from "../ImpersonationBanner";

interface PageProps {
  current_user?: {
    name?: string;
    email?: string;
  };
}

export default function AdminHeader() {
  const { current_user } = usePage<{ props: PageProps }>().props as PageProps;

  return (
    <>
      <ImpersonationBanner />
      <header className="bg-background py-3 sticky top-0 z-10 border-b border-border">
        <div className="flex justify-between items-center px-6">
          <img src="/images/launch10-logo.svg" alt="Launch10" className="h-8" />
          <div className="flex items-center text-muted-foreground text-sm">
            <CircleUserIcon className="mr-2 w-5 h-5" />
            {current_user?.name || current_user?.email || "Admin"}
          </div>
        </div>
      </header>
    </>
  );
}
