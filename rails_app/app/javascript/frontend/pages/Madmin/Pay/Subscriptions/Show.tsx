import { createElement } from "react";
import { Link } from "@inertiajs/react";
import {
  ArrowLeftIcon,
  CreditCardIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../../../layouts/admin-layout";

interface Subscription {
  id: number;
  name: string;
  status: string;
  processorId: string;
  processorPlan: string;
  quantity: number;
  customerName: string | null;
  customerEmail: string | null;
  trialEndsAt: string | null;
  endsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  metered: boolean;
  stripeAccount: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface SubscriptionShowProps {
  subscription: Subscription;
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

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; icon: typeof CheckCircleIcon }> = {
    active: { bg: "bg-green-100", text: "text-green-800", icon: CheckCircleIcon },
    trialing: { bg: "bg-blue-100", text: "text-blue-800", icon: ClockIcon },
    canceled: { bg: "bg-red-100", text: "text-red-800", icon: XCircleIcon },
    past_due: { bg: "bg-amber-100", text: "text-amber-800", icon: ClockIcon },
    paused: { bg: "bg-gray-100", text: "text-gray-800", icon: ClockIcon },
  };

  const config = statusConfig[status] || { bg: "bg-muted", text: "text-muted-foreground", icon: ClockIcon };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function SubscriptionShow({ subscription }: SubscriptionShowProps) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <Link
          href="/admin/pay/subscriptions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Subscriptions
        </Link>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCardIcon className="w-8 h-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">{subscription.name}</h1>
              <StatusBadge status={subscription.status} />
            </div>
            <p className="text-muted-foreground">
              {subscription.customerName} ({subscription.customerEmail})
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subscription Details */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Subscription Details</h2>
          <InfoRow label="ID" value={subscription.id} />
          <InfoRow label="Name" value={subscription.name} />
          <InfoRow label="Processor Plan" value={subscription.processorPlan} />
          <InfoRow label="Quantity" value={subscription.quantity} />
          <InfoRow label="Status" value={<StatusBadge status={subscription.status} />} />
          <InfoRow label="Metered" value={subscription.metered ? "Yes" : "No"} />
        </div>

        {/* Processor Info */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Processor Info</h2>
          <InfoRow label="Processor ID" value={subscription.processorId} />
          <InfoRow label="Stripe Account" value={subscription.stripeAccount} />
          {subscription.processorId && (
            <div className="mt-4">
              <a
                href={`https://dashboard.stripe.com/subscriptions/${subscription.processorId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                View on Stripe
              </a>
            </div>
          )}
        </div>

        {/* Billing Period */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Billing Period</h2>
          <InfoRow label="Period Start" value={formatDateTime(subscription.currentPeriodStart)} />
          <InfoRow label="Period End" value={formatDateTime(subscription.currentPeriodEnd)} />
          <InfoRow label="Trial Ends" value={formatDateTime(subscription.trialEndsAt)} />
          <InfoRow label="Ends At" value={formatDateTime(subscription.endsAt)} />
        </div>

        {/* Customer */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Customer</h2>
          <InfoRow label="Name" value={subscription.customerName} />
          <InfoRow label="Email" value={subscription.customerEmail} />
        </div>

        {/* Timestamps */}
        <div className="bg-card rounded-lg border border-border p-6 md:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Timestamps</h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Created" value={formatDateTime(subscription.createdAt)} />
            <InfoRow label="Updated" value={formatDateTime(subscription.updatedAt)} />
          </div>
        </div>
      </div>
    </div>
  );
}

SubscriptionShow.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default SubscriptionShow;
