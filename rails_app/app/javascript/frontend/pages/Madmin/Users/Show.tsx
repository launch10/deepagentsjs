import { createElement } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../../layouts/admin-layout";

interface User {
  id: number;
  name: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  admin: boolean;
  confirmed: boolean;
  timeZone: string | null;
  preferredLanguage: string | null;
  confirmedAt: string | null;
  acceptedTermsAt: string | null;
  acceptedPrivacyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserShowProps {
  user: User;
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function BooleanBadge({
  value,
  trueLabel = "Yes",
  falseLabel = "No",
}: {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return value ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
      <CheckCircleIcon className="w-3 h-3" />
      {trueLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
      <XCircleIcon className="w-3 h-3" />
      {falseLabel}
    </span>
  );
}

function UserShow({ user }: UserShowProps) {
  const { current_user } = usePage<{ props: { current_user?: { id: number } } }>().props as {
    current_user?: { id: number };
  };
  const isSelf = current_user?.id === user.id;

  const handleImpersonate = () => {
    router.post(`/admin/users/${user.id}/impersonate`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Users
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-foreground">{user.name}</h1>
                {user.admin && <ShieldCheckIcon className="w-6 h-6 text-primary" title="Admin" />}
              </div>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>

          {!isSelf && (
            <div className="flex gap-2">
              <button
                onClick={handleImpersonate}
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Impersonate
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>
          <InfoRow label="ID" value={user.id} />
          <InfoRow label="First Name" value={user.firstName || "—"} />
          <InfoRow label="Last Name" value={user.lastName || "—"} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Time Zone" value={user.timeZone || "—"} />
          <InfoRow label="Language" value={user.preferredLanguage || "—"} />
        </div>

        {/* Status */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Status</h2>
          <InfoRow label="Admin" value={<BooleanBadge value={user.admin} />} />
          <InfoRow label="Confirmed" value={<BooleanBadge value={user.confirmed} />} />
          <InfoRow label="Confirmed At" value={formatDateTime(user.confirmedAt)} />
          <InfoRow label="Accepted Terms" value={formatDateTime(user.acceptedTermsAt)} />
          <InfoRow label="Accepted Privacy" value={formatDateTime(user.acceptedPrivacyAt)} />
        </div>

        {/* Timestamps */}
        <div className="bg-card rounded-lg border border-border p-6 md:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Timestamps</h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Created" value={formatDateTime(user.createdAt)} />
            <InfoRow label="Updated" value={formatDateTime(user.updatedAt)} />
          </div>
        </div>
      </div>
    </div>
  );
}

UserShow.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default UserShow;
