import { createElement } from "react";
import { Link } from "@inertiajs/react";
import {
  ArrowLeftIcon,
  BuildingOfficeIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../../layouts/admin-layout";

interface Account {
  id: number;
  name: string;
  personal: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  usersCount: number;
  domain: string | null;
  subdomain: string | null;
  billingEmail: string | null;
  extraBillingInfo: string | null;
  timeZone: string | null;
  planName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AccountShowProps {
  account: Account;
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "—";
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
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function AccountShow({ account }: AccountShowProps) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <Link
          href="/admin/accounts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Accounts
        </Link>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {account.personal ? (
              <UserIcon className="w-8 h-8 text-muted-foreground" />
            ) : (
              <BuildingOfficeIcon className="w-8 h-8 text-primary" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">{account.name}</h1>
              <span
                className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                  account.personal
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {account.personal ? "Personal" : "Team"}
              </span>
            </div>
            <p className="text-muted-foreground">
              Owner: {account.ownerName} ({account.ownerEmail})
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Account Details</h2>
          <InfoRow label="ID" value={account.id} />
          <InfoRow label="Name" value={account.name} />
          <InfoRow label="Type" value={account.personal ? "Personal" : "Team"} />
          <InfoRow label="Users" value={account.usersCount} />
          <InfoRow label="Time Zone" value={account.timeZone} />
        </div>

        {/* Domain & Billing */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Domain & Billing</h2>
          <InfoRow label="Domain" value={account.domain} />
          <InfoRow label="Subdomain" value={account.subdomain} />
          <InfoRow label="Billing Email" value={account.billingEmail} />
          <InfoRow label="Plan" value={account.planName} />
        </div>

        {/* Timestamps */}
        <div className="bg-card rounded-lg border border-border p-6 md:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Timestamps</h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Created" value={formatDateTime(account.createdAt)} />
            <InfoRow label="Updated" value={formatDateTime(account.updatedAt)} />
          </div>
        </div>
      </div>
    </div>
  );
}

AccountShow.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default AccountShow;
