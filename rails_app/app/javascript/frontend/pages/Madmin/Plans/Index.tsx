import { createElement } from "react";
import { Link } from "@inertiajs/react";
import {
  CreditCardIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../../layouts/admin-layout";

interface Plan {
  id: number;
  name: string;
  amount: number;
  currency: string;
  interval: string;
  intervalCount: number;
  hidden: boolean;
  trialPeriodDays: number;
  createdAt: string;
}

interface PlansIndexProps {
  plans: Plan[];
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function PlansIndex({ plans }: PlansIndexProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Plans</h1>
        <p className="text-muted-foreground mt-1">
          Manage subscription plans ({plans.length} plans)
        </p>
      </header>

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Name
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                Price
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Interval
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Trial Days
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Visible
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
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className={`hover:bg-muted/30 transition-colors ${
                  plan.hidden ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CreditCardIcon className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {plan.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-mono text-foreground">
                    {formatCurrency(plan.amount, plan.currency)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                  {plan.intervalCount > 1 && `${plan.intervalCount} `}
                  {plan.interval}
                  {plan.intervalCount > 1 && "s"}
                </td>
                <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                  {plan.trialPeriodDays > 0 ? (
                    <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {plan.trialPeriodDays} days
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {plan.hidden ? (
                    <EyeSlashIcon className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                  ) : (
                    <EyeIcon className="w-5 h-5 text-green-500 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(plan.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/plans/${plan.id}`}
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

PlansIndex.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default PlansIndex;
