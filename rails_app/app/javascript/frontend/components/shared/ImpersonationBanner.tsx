import { router } from "@inertiajs/react";
import { useCurrentUser, useImpersonating } from "~/stores/sessionStore";

export default function ImpersonationBanner() {
  const currentUser = useCurrentUser();
  const impersonating = useImpersonating();

  if (!impersonating || !currentUser) return null;

  return (
    <div className="bg-red-500 text-white px-4 py-4 text-sm flex items-center justify-center gap-4">
      <span>
        Impersonating <strong>{currentUser.name || currentUser.email}</strong>
      </span>
      <button
        onClick={() => router.delete(`/admin/users/${currentUser.id}/impersonate`)}
        className="bg-red-800 hover:bg-red-700 px-3 py-2 rounded text-xs font-medium transition-colors"
      >
        Stop Impersonating
      </button>
    </div>
  );
}
