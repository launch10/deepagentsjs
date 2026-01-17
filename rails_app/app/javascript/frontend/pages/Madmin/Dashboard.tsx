import { createElement } from "react";
import {
  CurrencyDollarIcon,
  UsersIcon,
  CreditCardIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../layouts/admin-layout";

interface DashboardProps {
  totalRevenue: number;
  last12Mos: number;
  lastMonth: number;
  thisMonth: number;
  userCount: number;
  activeSubscriptions: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor?: string;
}

function MetricCard({ title, value, icon: Icon, iconColor = "text-primary" }: MetricCardProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg bg-primary/10 ${iconColor}`}>
          <Icon className="w-6 h-6" strokeWidth={1.5} />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DashboardPage({
  totalRevenue,
  last12Mos,
  lastMonth,
  thisMonth,
  userCount,
  activeSubscriptions,
}: DashboardProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your application metrics</p>
      </header>

      {/* Revenue Metrics */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Revenue</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
            icon={CurrencyDollarIcon}
          />
          <MetricCard
            title="Last 12 Months"
            value={formatCurrency(last12Mos)}
            icon={CalendarIcon}
          />
          <MetricCard
            title="Last Month"
            value={formatCurrency(lastMonth)}
            icon={CalendarIcon}
          />
          <MetricCard
            title="This Month"
            value={formatCurrency(thisMonth)}
            icon={CalendarIcon}
          />
        </div>
      </section>

      {/* User Metrics */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">Users & Subscriptions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Total Users"
            value={userCount.toLocaleString()}
            icon={UsersIcon}
          />
          <MetricCard
            title="Active Subscriptions"
            value={activeSubscriptions.toLocaleString()}
            icon={CreditCardIcon}
          />
        </div>
      </section>
    </div>
  );
}

// Use AdminLayout for admin pages
DashboardPage.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default DashboardPage;
