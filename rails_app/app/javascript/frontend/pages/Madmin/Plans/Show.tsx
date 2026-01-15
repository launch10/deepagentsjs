import { createElement } from "react";
import { Link } from "@inertiajs/react";
import {
  ArrowLeftIcon,
  CreditCardIcon,
  CheckIcon,
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
  description: string | null;
  features: string[];
  chargePerUnit: boolean;
  unitLabel: string | null;
  contactUrl: string | null;
  stripeId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlanShowProps {
  plan: Plan;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
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

function PlanShow({ plan }: PlanShowProps) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <Link
          href="/admin/plans"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Plans
        </Link>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCardIcon className="w-8 h-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">{plan.name}</h1>
              {plan.hidden && (
                <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  Hidden
                </span>
              )}
            </div>
            <p className="text-2xl font-semibold text-primary">
              {formatCurrency(plan.amount, plan.currency)}
              <span className="text-sm font-normal text-muted-foreground">
                /{plan.interval}
              </span>
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pricing Details */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Pricing Details</h2>
          <InfoRow label="ID" value={plan.id} />
          <InfoRow label="Amount" value={formatCurrency(plan.amount, plan.currency)} />
          <InfoRow label="Currency" value={plan.currency.toUpperCase()} />
          <InfoRow
            label="Interval"
            value={`${plan.intervalCount > 1 ? plan.intervalCount + " " : ""}${plan.interval}${plan.intervalCount > 1 ? "s" : ""}`}
          />
          <InfoRow label="Trial Period" value={plan.trialPeriodDays > 0 ? `${plan.trialPeriodDays} days` : "None"} />
          <InfoRow label="Visible" value={plan.hidden ? "No" : "Yes"} />
        </div>

        {/* Configuration */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Configuration</h2>
          <InfoRow label="Stripe ID" value={plan.stripeId} />
          <InfoRow label="Charge Per Unit" value={plan.chargePerUnit ? "Yes" : "No"} />
          <InfoRow label="Unit Label" value={plan.unitLabel} />
          <InfoRow label="Contact URL" value={plan.contactUrl} />
        </div>

        {/* Description */}
        {plan.description && (
          <div className="bg-card rounded-lg border border-border p-6 md:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-4">Description</h2>
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          </div>
        )}

        {/* Features */}
        {plan.features && plan.features.length > 0 && (
          <div className="bg-card rounded-lg border border-border p-6 md:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-4">Features</h2>
            <ul className="space-y-2">
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckIcon className="w-4 h-4 text-green-500 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Timestamps */}
        <div className="bg-card rounded-lg border border-border p-6 md:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Timestamps</h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Created" value={formatDateTime(plan.createdAt)} />
            <InfoRow label="Updated" value={formatDateTime(plan.updatedAt)} />
          </div>
        </div>
      </div>
    </div>
  );
}

PlanShow.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default PlanShow;
