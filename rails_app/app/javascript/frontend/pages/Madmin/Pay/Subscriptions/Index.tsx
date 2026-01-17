import { createElement } from "react";
import { Link } from "@inertiajs/react";
import {
  CreditCardIcon,
  EyeIcon,
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
  createdAt: string;
}

interface SubscriptionsIndexProps {
  subscriptions: Subscription[];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function SubscriptionsIndex({ subscriptions }: SubscriptionsIndexProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Subscriptions</h1>
        <p className="text-muted-foreground mt-1">
          Manage customer subscriptions ({subscriptions.length} subscriptions)
        </p>
      </header>

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Plan
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Customer
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Qty
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Created
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subscriptions.map((subscription) => (
              <tr key={subscription.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CreditCardIcon className="w-4 h-4 text-primary" />
                    <div>
                      <span className="font-medium text-foreground">
                        {subscription.name}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        {subscription.processorPlan}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">
                    <div className="text-foreground">{subscription.customerName || "—"}</div>
                    <div className="text-muted-foreground text-xs">{subscription.customerEmail}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={subscription.status} />
                </td>
                <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                  {subscription.quantity}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(subscription.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/pay/subscriptions/${subscription.id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <EyeIcon className="w-4 h-4" />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

SubscriptionsIndex.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default SubscriptionsIndex;
