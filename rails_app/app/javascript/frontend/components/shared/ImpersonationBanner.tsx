import { router, usePage } from "@inertiajs/react";

interface PageProps {
  current_user?: {
    id: number;
    name: string;
    email: string;
  };
  impersonating?: boolean;
}

export default function ImpersonationBanner() {
  const { current_user, impersonating } = usePage<{ props: PageProps }>().props as PageProps;

  if (!impersonating || !current_user) return null;

  return (
    <div className="bg-red-500 text-white px-4 py-4 text-sm flex items-center justify-center gap-4">
      <span>
        Impersonating <strong>{current_user.name || current_user.email}</strong>
      </span>
      <button
        onClick={() => router.delete(`/admin/users/${current_user.id}/impersonate`)}
        className="bg-red-800 hover:bg-red-700 px-3 py-2 rounded text-xs font-medium transition-colors"
      >
        Stop Impersonating
      </button>
    </div>
  );
}
