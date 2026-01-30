import { useState } from "react";
import { usePage, Link } from "@inertiajs/react";
import { Bar, BarChart, Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, MinusIcon } from "@heroicons/react/16/solid";
import type { InertiaProps } from "@shared";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@components/ui/chart";

// Use generated types from RSwag
export type ProjectPerformanceProps =
  InertiaProps.paths["/projects/{uuid}/performance"]["get"]["responses"]["200"]["content"]["application/json"];

// Derive nested types from generated type
type Metrics = ProjectPerformanceProps["metrics"][string];
type Summary = Metrics["summary"];
type Trend = NonNullable<Summary["ad_spend_trend"]>;
type TimeSeries = Metrics["impressions"];

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
  const hasData = metrics.has_data;

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
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-base-500 whitespace-nowrap">Filter by:</span>
              <select
                value={selectedDays}
                onChange={(e) => handleDateRangeChange(Number(e.target.value))}
                className="text-sm border border-neutral-300 rounded-md px-3 py-1.5 bg-white min-w-[120px]"
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

        {/* Info Banner - shown when no data */}
        {!hasData && <NoDataBanner />}

        {/* Summary Cards */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Ad Spend"
              description="Total cost for date range"
              value={hasData ? `$${Number(metrics.summary.ad_spend ?? 0).toFixed(2)}` : null}
              trend={hasData ? metrics.summary.ad_spend_trend : undefined}
              invertTrend={true}
            />
            <SummaryCard
              title="Leads"
              description="Form submissions not attributed to ads"
              value={hasData ? String(metrics.summary.leads ?? 0) : null}
              trend={hasData ? metrics.summary.leads_trend : undefined}
              link={
                hasData
                  ? {
                      href: `/projects/${project.uuid}/leads`,
                      label: "View Leads",
                    }
                  : undefined
              }
            />
            <SummaryCard
              title="Avg Cost per Lead"
              description="Spend required to generate a lead"
              value={
                hasData && metrics.summary.cpl != null
                  ? `$${Number(metrics.summary.cpl).toFixed(2)}`
                  : null
              }
              trend={hasData ? metrics.summary.cpl_trend : undefined}
              invertTrend={true}
            />
            <SummaryCard
              title="Return on Ad Spend"
              description="Revenue earned from ad spend"
              value={
                hasData && metrics.summary.roas != null
                  ? `${Number(metrics.summary.roas).toFixed(2)}x`
                  : null
              }
              trend={hasData ? metrics.summary.roas_trend : undefined}
            />
          </div>
        </section>

        {/* Charts */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BarChartCard
              title="Impressions"
              data={metrics.impressions}
              dateRange={dateRangeLabel}
              hasData={hasData}
            />
            <BarChartCard
              title="Ad Clicks"
              data={metrics.clicks}
              dateRange={dateRangeLabel}
              hasData={hasData}
            />
            <LineChartCard
              title="Click-Through Rate"
              data={metrics.ctr}
              dateRange={dateRangeLabel}
              valueFormatter={(v) => `${(v * 100).toFixed(1)}%`}
              hasData={hasData}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function NoDataBanner() {
  return (
    <div
      className="mb-8 rounded-lg border border-neutral-300 bg-[#FAFAF9] p-4 flex items-start gap-3"
      data-testid="no-data-banner"
    >
      <div className="flex-shrink-0 mt-0.5">
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-[#2E3238]"
        >
          <path
            d="M8 14.667A6.667 6.667 0 1 0 8 1.333a6.667 6.667 0 0 0 0 13.334ZM8 5.333V8M8 10.667h.007"
            stroke="currentColor"
            strokeWidth="1.33"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-base text-[#2E3238] leading-5">Not enough data yet</h3>
        <p className="text-sm text-[#2E3238] leading-[18px] mt-1">
          Check back in 24–48 hours after your campaign starts running. Google Ads typically needs a
          day to report initial metrics.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  description,
  value,
  link,
  trend,
  invertTrend = false,
}: {
  title: string;
  description: string;
  value: string | null;
  link?: { href: string; label: string };
  trend?: Trend;
  invertTrend?: boolean;
}) {
  const isEmpty = value === null;

  // Determine if the trend is "good" based on direction and whether it's inverted
  // invertTrend=true means down is good (e.g., Ad Spend, CPL)
  const isGoodTrend =
    trend?.direction === "flat"
      ? null
      : invertTrend
        ? trend?.direction === "down"
        : trend?.direction === "up";

  // Determine background color based on trend
  const getTrendBgColor = () => {
    if (trend?.direction === "flat") return "bg-neutral-100";
    return isGoodTrend ? "bg-success-100" : "bg-secondary-100";
  };

  return (
    <div className="rounded-2xl border border-neutral-300 bg-white p-4 relative">
      {/* Trend icon in top right */}
      {trend && !isEmpty && (
        <div className="absolute top-4 right-4">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ${getTrendBgColor()}`}
          >
            <TrendIcon direction={trend.direction} isGood={isGoodTrend ?? false} />
          </div>
        </div>
      )}

      <div className="mb-2 pr-10">
        <h3 className="text-sm font-medium text-[#2E3238]">{title}</h3>
        <p className="text-xs text-[#96989B]">{description}</p>
      </div>

      {isEmpty ? (
        <div className="flex items-center gap-2 mt-4">
          <div className="w-[33px] h-[33px] rounded-full bg-neutral-100 flex items-center justify-center">
            <ChartBarIcon size={13} />
          </div>
          <span className="text-xs text-[#96989B]">No data available yet</span>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

function TrendIcon({ direction, isGood }: { direction: "up" | "down" | "flat"; isGood: boolean }) {
  const colorClass =
    direction === "flat" ? "text-neutral-500" : isGood ? "text-success-700" : "text-secondary-700";

  if (direction === "up") {
    return <ArrowTrendingUpIcon className={`w-4 h-4 ${colorClass}`} />;
  }

  if (direction === "down") {
    return <ArrowTrendingDownIcon className={`w-4 h-4 ${colorClass}`} />;
  }

  // Flat trend
  return <MinusIcon className={`w-4 h-4 ${colorClass}`} />;
}

function BarChartCard({
  title,
  data,
  dateRange,
  hasData,
}: {
  title: string;
  data: TimeSeries;
  dateRange: string;
  hasData: boolean;
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
    <div className="rounded-2xl border border-neutral-300 bg-white p-4">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-[#0F1113]">{title}</h3>
        <p className="text-xs text-[#96989B]">{dateSubtitle}</p>
      </div>

      {hasData ? (
        <>
          <div className="mb-2">
            <span className="text-2xl font-semibold text-[#2E3238]">{total.toLocaleString()}</span>
          </div>

          {chartData.length > 0 && (
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
                    tickFormatter={(value) =>
                      value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                    }
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent labelFormatter={(label) => label} />}
                  />
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
  hasData,
}: {
  title: string;
  data: TimeSeries;
  dateRange: string;
  valueFormatter: (value: number) => string;
  hasData: boolean;
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
    <div className="rounded-2xl border border-neutral-300 bg-white p-4">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-[#0F1113]">{title}</h3>
        <p className="text-xs text-[#96989B]">{dateSubtitle}</p>
      </div>

      {hasData ? (
        <>
          <div className="mb-2">
            <span className="text-2xl font-semibold text-[#2E3238]">
              {valueFormatter(currentValue)}
            </span>
          </div>

          {chartData.length > 0 && (
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
    <div className="h-[200px] flex flex-col items-center justify-center gap-3">
      <div className="w-[60px] h-[60px] rounded-full bg-neutral-100 flex items-center justify-center">
        <ChartBarIcon size={24} />
      </div>
      <span className="text-xs text-[#96989B]">No data available yet</span>
    </div>
  );
}

function ChartBarIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-neutral-400"
    >
      <rect x="2" y="11" width="4" height="7" rx="1" fill="currentColor" />
      <rect x="8" y="7" width="4" height="11" rx="1" fill="currentColor" />
      <rect x="14" y="3" width="4" height="15" rx="1" fill="currentColor" />
    </svg>
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
