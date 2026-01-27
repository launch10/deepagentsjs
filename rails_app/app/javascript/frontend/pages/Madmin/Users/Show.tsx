import { createElement, useState } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  UserIcon,
  GiftIcon,
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
  totalCredits: number;
  planCredits: number;
  packCredits: number;
}

interface UserShowProps {
  user: User;
  creditReasons: string[];
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

function formatCredits(credits: number): string {
  return credits.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
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

function GiftCreditsForm({ userId, reasons }: { userId: number; reasons: string[] }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(reasons[0] || "customer_support");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    router.post(
      `/admin/users/${userId}/credit_gifts`,
      {
        credit_gift: {
          amount: parseInt(amount, 10),
          reason,
          notes: notes || undefined,
        },
      },
      {
        onFinish: () => {
          setSubmitting(false);
          setAmount("");
          setNotes("");
          queryClient.invalidateQueries({ queryKey: ["creditGifts", userId] });
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="gift-amount" className="block text-sm font-medium text-muted-foreground mb-1">
          Amount (credits)
        </label>
        <input
          id="gift-amount"
          type="number"
          min="1"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="e.g. 500"
        />
      </div>
      <div>
        <label htmlFor="gift-reason" className="block text-sm font-medium text-muted-foreground mb-1">
          Reason
        </label>
        <select
          id="gift-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {reasons.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="gift-notes" className="block text-sm font-medium text-muted-foreground mb-1">
          Notes (optional)
        </label>
        <textarea
          id="gift-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="Internal notes about this gift..."
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !amount}
        className="w-full px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {submitting ? "Granting..." : "Grant Credits"}
      </button>
    </form>
  );
}

interface CreditGiftRecord {
  id: number;
  amount: number;
  reason: string;
  notes: string | null;
  credits_allocated: boolean;
  admin_name: string;
  created_at: string;
}

interface CreditGiftPagination {
  current_page: number;
  total_pages: number;
  total_count: number;
  prev_page: number | null;
  next_page: number | null;
}

interface CreditGiftResponse {
  gifts: CreditGiftRecord[];
  pagination: CreditGiftPagination;
}

function CreditGiftHistory({ userId }: { userId: number }) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<CreditGiftResponse>({
    queryKey: ["creditGifts", userId, page],
    queryFn: async () => {
      const res = await fetch(`/admin/users/${userId}/credit_gifts.json?page=${page}`);
      if (!res.ok) throw new Error("Failed to fetch credit gifts");
      return res.json();
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground py-4">Loading gift history...</p>;
  }

  if (isError) {
    return <p className="text-sm text-destructive py-4">Failed to load gift history.</p>;
  }

  if (!data || data.gifts.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No gifts yet.</p>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="py-2 pr-4 font-medium text-muted-foreground">Date</th>
              <th className="py-2 pr-4 font-medium text-muted-foreground">Admin</th>
              <th className="py-2 pr-4 font-medium text-muted-foreground">Amount</th>
              <th className="py-2 pr-4 font-medium text-muted-foreground">Reason</th>
              <th className="py-2 pr-4 font-medium text-muted-foreground">Notes</th>
              <th className="py-2 font-medium text-muted-foreground">Allocated</th>
            </tr>
          </thead>
          <tbody>
            {data.gifts.map((gift) => (
              <tr key={gift.id} className="border-b border-border last:border-0">
                <td className="py-2 pr-4 text-foreground">{formatDateTime(gift.created_at)}</td>
                <td className="py-2 pr-4 text-foreground">{gift.admin_name}</td>
                <td className="py-2 pr-4 text-foreground">{formatCredits(gift.amount)}</td>
                <td className="py-2 pr-4 text-foreground">
                  {gift.reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </td>
                <td className="py-2 pr-4 text-muted-foreground">{gift.notes || "—"}</td>
                <td className="py-2">
                  <BooleanBadge value={gift.credits_allocated} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
          <span className="text-sm text-muted-foreground">
            Page {data.pagination.current_page} of {data.pagination.total_pages} ({data.pagination.total_count} total)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={!data.pagination.prev_page}
              className="px-3 py-1 text-sm rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.pagination.next_page}
              className="px-3 py-1 text-sm rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserShow({ user, creditReasons }: UserShowProps) {
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

        {/* Credits */}
        <div className="bg-card rounded-lg border border-border p-6 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Credits</h2>
            <Link
              href={`/admin/users/${user.id}/credit_transactions`}
              className="text-sm text-primary hover:text-primary/80 transition-colors"
            >
              View Transactions
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold text-foreground">{formatCredits(user.totalCredits)}</div>
              <div className="text-xs text-muted-foreground mt-1">Total</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold text-foreground">{formatCredits(user.planCredits)}</div>
              <div className="text-xs text-muted-foreground mt-1">Plan</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className="text-2xl font-bold text-foreground">{formatCredits(user.packCredits)}</div>
              <div className="text-xs text-muted-foreground mt-1">Pack</div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-4">
              <GiftIcon className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Gift Credits</h3>
            </div>
            <GiftCreditsForm userId={user.id} reasons={creditReasons} />
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Gift History</h3>
            <CreditGiftHistory userId={user.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

UserShow.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default UserShow;
