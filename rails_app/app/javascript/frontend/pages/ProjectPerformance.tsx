import { useState } from "react";
import { usePage, Link } from "@inertiajs/react";
import { Bar, BarChart, Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@components/ui/chart";

// Types
interface Project {
  id: number;
  uuid: string;
  name: string;
  website_id: number | null;
  account_id: number;
  created_at: string;
  updated_at: string;
}

interface Summary {
  ad_spend: number;
  leads: number;
  cpl: number | null;
  roas: number | null;
}

interface Totals {
  current: number;
  previous: number;
  trend_percent: number;
  trend_direction: "up" | "down" | "flat";
}

interface TimeSeries {
  dates: string[];
  data: number[];
  totals: Totals;
}

interface Metrics {
  summary: Summary;
  impressions: TimeSeries;
  clicks: TimeSeries;
  ctr: TimeSeries;
}

interface DateRangeOption {
  days: number;
  label: string;
}

interface ProjectPerformanceProps {
  project: Project;
  metrics: Record<string, Metrics>;
  date_range_options: DateRangeOption[];
}

type DaysKey = "7" | "30" | "90" | "0";
const DEFAULT_DAYS: DaysKey = "30";

// Colors matching Launch10 design system
const PRIMARY_COLOR = "#0D9488"; // teal

export default function ProjectPerformance() {
  const {
    project,
    metrics: allMetrics,
    date_range_options,
  } = usePage<ProjectPerformanceProps>().props;

  const [selectedDays, setSelectedDays] = useState<DaysKey>(DEFAULT_DAYS);

  // Get metrics for selected date range
  const metrics = allMetrics[selectedDays];

  const handleDateRangeChange = (days: number) => {
    setSelectedDays(String(days) as DaysKey);
  };

  // Find the selected date range option for display
  const selectedOption = date_range_options.find((opt) => String(opt.days) === selectedDays);
  const dateRangeLabel = selectedOption?.label || "Last 30 days";

  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <div className="pl-4 pr-[3%] py-6 lg:pl-12 lg:pr-[5%] lg:py-10">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="text-sm text-base-500 hover:text-base-700 inline-flex items-center gap-1 mb-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60">
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Projects
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-['IBM_Plex_Serif'] text-[28px] font-semibold text-[#2E3238]">
                Performance
              </h1>
              <p className="text-base-500 text-sm mt-1">{project.name}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-base-500">Filter by:</span>
              <select
                value={selectedDays}
                onChange={(e) => handleDateRangeChange(Number(e.target.value))}
                className="text-sm border border-neutral-300 rounded-md px-3 py-1.5 bg-white"
              >
                {date_range_options.map((option) => (
                  <option key={option.days} value={option.days}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Ad Spend"
              description="Total cost for date range"
              value={`$${(metrics.summary.ad_spend ?? 0).toFixed(2)}`}
              icon="spend"
            />
            <SummaryCard
              title="Leads"
              description="Form submissions not attributed to ads"
              value={(metrics.summary.leads ?? 0).toString()}
              icon="leads"
              link={{
                href: `/projects/${project.uuid}/leads`,
                label: "View Leads",
              }}
            />
            <SummaryCard
              title="Avg Cost per Lead"
              description="Spend required to generate a lead"
              value={metrics.summary.cpl != null ? `$${metrics.summary.cpl.toFixed(2)}` : "-"}
              icon="cpl"
            />
            <SummaryCard
              title="Return on Ad Spend"
              description="Revenue earned from ad spend"
              value={metrics.summary.roas != null ? `${metrics.summary.roas.toFixed(2)}x` : "-"}
              icon="roas"
            />
          </div>
        </section>

        {/* Charts */}
        <section>
          <h2 className="text-lg font-semibold text-[#2E3238] mb-4">Engagement Metrics</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BarChartCard
              title="Impressions"
              data={metrics.impressions}
              dateRange={dateRangeLabel}
            />
            <BarChartCard title="Ad Clicks" data={metrics.clicks} dateRange={dateRangeLabel} />
            <LineChartCard
              title="Click-Through Rate"
              data={metrics.ctr}
              dateRange={dateRangeLabel}
              valueFormatter={(v) => `${(v * 100).toFixed(1)}%`}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  description,
  value,
  icon,
  link,
}: {
  title: string;
  description: string;
  value: string;
  icon: "spend" | "leads" | "cpl" | "roas";
  link?: { href: string; label: string };
}) {
  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4 relative">
      {/* Trend icon in top right */}
      <div className="absolute top-4 right-4">
        <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center">
          <TrendIcon type={icon} />
        </div>
      </div>

      <div className="pr-10">
        <h3 className="text-sm font-semibold text-[#2E3238]">{title}</h3>
        <p className="text-xs text-base-400 mb-2">{description}</p>
      </div>

      <p className="text-2xl font-semibold text-[#2E3238] mb-1">{value}</p>

      {link && (
        <Link
          href={link.href}
          className="text-xs font-medium text-base-600 hover:text-base-700 inline-flex items-center gap-1"
        >
          {link.label}
          <span aria-hidden="true">&rarr;</span>
        </Link>
      )}
    </div>
  );
}

function TrendIcon({ type }: { type: "spend" | "leads" | "cpl" | "roas" }) {
  // Coral/orange arrow icon matching Figma
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-secondary-500"
    >
      <path
        d="M4 12L12 4M12 4H6M12 4V10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BarChartCard({
  title,
  data,
  dateRange,
}: {
  title: string;
  data: TimeSeries;
  dateRange: string;
}) {
  const chartData = data.dates.map((date, index) => ({
    date,
    displayDate: formatDate(date),
    value: data.data[index] || 0,
  }));

  const chartConfig: ChartConfig = {
    value: {
      label: title,
      color: PRIMARY_COLOR,
    },
  };

  // Calculate date range for subtitle
  const startDate = data.dates[0];
  const endDate = data.dates[data.dates.length - 1];
  const dateSubtitle =
    startDate && endDate
      ? `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`
      : dateRange;

  const total = data.totals.current;
  const trendPercent = data.totals.trend_percent;
  const trendDirection = data.totals.trend_direction;

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-[#2E3238]">{title}</h3>
        <p className="text-xs text-base-400">{dateSubtitle}</p>
      </div>

      <div className="mb-2">
        <span className="text-2xl font-semibold text-[#2E3238]">{total.toLocaleString()}</span>
      </div>

      {chartData.length > 0 ? (
        <>
          <ChartContainer config={chartConfig} className="h-[120px] w-full">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: "#9CA3AF" }}
                tickMargin={8}
                minTickGap={30}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: "#9CA3AF" }}
                tickMargin={4}
                tickFormatter={(value) => (value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value)}
              />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => label} />} />
              <Bar dataKey="value" fill={PRIMARY_COLOR} radius={[2, 2, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ChartContainer>

          {trendDirection !== "flat" && (
            <p
              className={`text-xs mt-2 flex items-center gap-1 ${trendDirection === "up" ? "text-green-600" : "text-red-600"}`}
            >
              Trending {trendDirection} by {trendPercent.toFixed(1)}% this week
              <span aria-hidden="true">{trendDirection === "up" ? "\u2197" : "\u2198"}</span>
            </p>
          )}
        </>
      ) : (
        <EmptyChartState />
      )}
    </div>
  );
}

function LineChartCard({
  title,
  data,
  dateRange,
  valueFormatter,
}: {
  title: string;
  data: TimeSeries;
  dateRange: string;
  valueFormatter: (value: number) => string;
}) {
  const chartData = data.dates.map((date, index) => ({
    date,
    displayDate: formatDate(date),
    value: data.data[index] || 0,
  }));

  const chartConfig: ChartConfig = {
    value: {
      label: title,
      color: PRIMARY_COLOR,
    },
  };

  // Calculate date range for subtitle
  const startDate = data.dates[0];
  const endDate = data.dates[data.dates.length - 1];
  const dateSubtitle =
    startDate && endDate
      ? `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`
      : dateRange;

  const currentValue = data.totals.current;
  const trendPercent = data.totals.trend_percent;
  const trendDirection = data.totals.trend_direction;

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-[#2E3238]">{title}</h3>
        <p className="text-xs text-base-400">{dateSubtitle}</p>
      </div>

      <div className="mb-2">
        <span className="text-2xl font-semibold text-[#2E3238]">
          {valueFormatter(currentValue)}
        </span>
      </div>

      {chartData.length > 0 ? (
        <>
          <ChartContainer config={chartConfig} className="h-[120px] w-full">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
              <XAxis
                dataKey="displayDate"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: "#9CA3AF" }}
                tickMargin={8}
                minTickGap={30}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 9, fill: "#9CA3AF" }}
                tickMargin={4}
                tickFormatter={(value) => valueFormatter(value)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(label) => label}
                    formatter={(value) => [valueFormatter(value as number), title]}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={PRIMARY_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>

          {trendDirection !== "flat" && (
            <p
              className={`text-xs mt-2 flex items-center gap-1 ${trendDirection === "up" ? "text-green-600" : "text-red-600"}`}
            >
              Trending {trendDirection} by {trendPercent.toFixed(1)}% this week
              <span aria-hidden="true">{trendDirection === "up" ? "\u2197" : "\u2198"}</span>
            </p>
          )}
        </>
      ) : (
        <EmptyChartState />
      )}
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="h-[120px] flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-neutral-400"
        >
          <rect x="2" y="11" width="4" height="7" rx="1" fill="currentColor" />
          <rect x="8" y="7" width="4" height="11" rx="1" fill="currentColor" />
          <rect x="14" y="3" width="4" height="15" rx="1" fill="currentColor" />
        </svg>
      </div>
      <span className="text-xs text-base-400">No data available yet</span>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateShort(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
