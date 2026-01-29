import { useState, useMemo } from "react";
import { usePage, Link } from "@inertiajs/react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { InertiaProps } from "@shared";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@components/ui/chart";
import { useInsightsChat } from "@hooks/useInsightsChat";

// Use generated types from RSwag
export type DashboardProps =
  InertiaProps.paths["/dashboard"]["get"]["responses"]["200"]["content"]["application/json"];

// Derived types - access from the keyed structure
type Performance = DashboardProps["all_performance"]["7"];
type TimeSeries = Performance["leads"];
type SeriesData = TimeSeries["series"][number];
type Insight = NonNullable<DashboardProps["insights"]>[number];
type ProjectSummary = DashboardProps["all_projects"]["7"][number];
type DateRangeOption = DashboardProps["date_range_options"][number];
type StatusCounts = DashboardProps["status_counts"];
type ProjectStatus = ProjectSummary["status"];
type DaysKey = "7" | "30" | "90";

// Color palette for projects (matches Figma)
const PROJECT_COLORS = [
  "#0D9488", // teal
  "#F97316", // orange
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#10B981", // green
  "#3B82F6", // blue
];

const DEFAULT_DAYS: DaysKey = "30";

export default function Dashboard() {
  const { all_performance, all_projects, status_counts, date_range_options, current_user } =
    usePage<DashboardProps>().props;

  // Generate insights via Langgraph if not already cached
  const { insights, isGenerating: isGeneratingInsights } = useInsightsChat();

  // Client-side state for instant switching - no server round-trips
  const [selectedDays, setSelectedDays] = useState<DaysKey>(DEFAULT_DAYS);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const firstName = current_user?.name?.split(" ")[0] || "there";

  // Get performance and projects for selected date range
  const performance = all_performance[selectedDays];
  const projects = all_projects[selectedDays];

  // Filter projects client-side based on selected status
  const filteredProjects = useMemo(() => {
    if (statusFilter === "all") return projects;
    return projects.filter((project) => project.status === statusFilter);
  }, [projects, statusFilter]);

  // Build chart config from project series
  const buildChartConfig = (series: SeriesData[]): ChartConfig => {
    const config: ChartConfig = {};
    series.forEach((s, index) => {
      config[s.project_uuid] = {
        label:
          s.project_name.length > 25 ? s.project_name.substring(0, 25) + "..." : s.project_name,
        color: PROJECT_COLORS[index % PROJECT_COLORS.length],
      };
    });
    return config;
  };

  // Date range is now client-side only - instant switching
  const handleDateRangeChange = (days: number) => {
    setSelectedDays(String(days) as DaysKey);
  };

  // Status filter is client-side only - instant switching
  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
  };

  // Generate date range label
  const dateRangeLabel = `Last ${selectedDays} Days`;

  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <div className="pl-4 pr-[3%] py-6 lg:pl-12 lg:pr-[5%] lg:py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-['IBM_Plex_Serif'] text-[28px] font-semibold text-[#2E3238]">
            Welcome Back, <em>{firstName}</em>
          </h1>
          <p className="text-base-500 text-sm mt-1">
            Here's an overview of your pages and campaigns
          </p>
        </div>

        {/* Key Insights */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#2E3238] mb-4">Key Insights</h2>
          {isGeneratingInsights ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InsightLoadingCard />
              <InsightLoadingCard />
              <InsightLoadingCard />
            </div>
          ) : insights && insights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.map((insight, index) => (
                <InsightCard key={index} insight={insight} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <InsightEmptyCard />
            </div>
          )}
        </section>

        {/* Performance Overview */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-[#2E3238]">Performance Overview</h2>
              {/* Project Legend */}
              <div className="flex items-center gap-4">
                {performance.leads.series.map((s, index) => (
                  <div key={s.project_uuid} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: PROJECT_COLORS[index % PROJECT_COLORS.length] }}
                    />
                    <span className="text-xs text-base-500">
                      {s.project_name.length > 20
                        ? s.project_name.substring(0, 20) + "..."
                        : s.project_name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-base-500">Filter by:</span>
              <select
                value={selectedDays}
                onChange={(e) => handleDateRangeChange(Number(e.target.value))}
                className="text-sm border border-neutral-300 rounded-md px-3 py-1.5 bg-white"
              >
                {date_range_options.map((option: DateRangeOption) => (
                  <option key={option.days} value={option.days}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricChart
              title="Total Leads"
              data={performance.leads}
              chartConfig={buildChartConfig(performance.leads.series)}
              dateRange={dateRangeLabel}
            />
            <MetricChart
              title="Cost-per-Lead"
              data={performance.cpl}
              chartConfig={buildChartConfig(performance.cpl.series)}
              dateRange={dateRangeLabel}
              prefix="$"
              valueFormatter={(v) => (v != null ? `$${v.toFixed(2)}` : "-")}
            />
            <MetricChart
              title="Click-Through Rate"
              data={performance.ctr}
              chartConfig={buildChartConfig(performance.ctr.series)}
              dateRange={dateRangeLabel}
              suffix="%"
              valueFormatter={(v) => (v != null ? `${(v * 100).toFixed(1)}%` : "-")}
            />
            <MetricChart
              title="Page Views"
              data={performance.page_views}
              chartConfig={buildChartConfig(performance.page_views.series)}
              dateRange={dateRangeLabel}
            />
          </div>
        </section>

        {/* Projects */}
        <section>
          <h2 className="text-lg font-semibold text-[#2E3238] mb-4">Projects</h2>
          <ProjectFilterTabs
            statusCounts={status_counts}
            activeFilter={statusFilter}
            onFilterChange={handleStatusFilterChange}
          />
          {filteredProjects && filteredProjects.length > 0 ? (
            <div className="space-y-3">
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-300 bg-white p-8 text-center">
              <p className="text-base-500">
                {statusFilter === "all"
                  ? "No projects yet. Create your first project to get started."
                  : `No ${statusFilter} projects.`}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  // Use Launch10 Design System colors (from application.css)
  const sentimentColors = {
    positive: "border-success-200 bg-success-100",
    negative: "border-secondary-200 bg-secondary-100",
    neutral: "border-accent-green-200 bg-accent-green-100",
  };

  const titleColors = {
    positive: "text-success-600",
    negative: "text-secondary-600",
    neutral: "text-accent-green-600",
  };

  return (
    <div className={`rounded-lg border p-4 ${sentimentColors[insight.sentiment]}`}>
      <h3 className={`font-semibold text-sm mb-1 ${titleColors[insight.sentiment]}`}>
        {insight.title}
      </h3>
      <p className="text-xs text-base-600 mb-3">{insight.description}</p>
      <a
        href={insight.action.url}
        className="inline-flex items-center gap-1 text-xs font-medium text-base-700 hover:underline"
      >
        {insight.action.label}
        <span aria-hidden="true">&rarr;</span>
      </a>
    </div>
  );
}

function InsightEmptyCard() {
  return (
    <div className="rounded-lg border border-accent-yellow-200 bg-accent-yellow-100 p-4">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10.667 1.333L9.733 4.267L6.8 5.2L9.733 6.133L10.667 9.067L11.6 6.133L14.533 5.2L11.6 4.267L10.667 1.333Z"
              fill="#e5a24c"
            />
            <path
              d="M4.667 6L3.867 8.4L1.467 9.2L3.867 10L4.667 12.4L5.467 10L7.867 9.2L5.467 8.4L4.667 6Z"
              fill="#e5a24c"
            />
            <path
              d="M8 11.333L7.467 13.067L5.733 13.6L7.467 14.133L8 15.867L8.533 14.133L10.267 13.6L8.533 13.067L8 11.333Z"
              fill="#e5a24c"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1 text-accent-yellow-700">
            Project Recently Launched
          </h3>
          <p className="text-xs text-base-600 mb-3">
            Your project is brand new, so there's no data yet. Check back soon or review your
            project details to get started.
          </p>
          <a
            href="/projects"
            className="inline-flex items-center gap-1 text-xs font-medium text-base-700 hover:underline"
          >
            Review
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function InsightLoadingCard() {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 animate-pulse">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-4 h-4 bg-neutral-200 rounded" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-neutral-200 rounded w-3/4" />
          <div className="h-3 bg-neutral-200 rounded w-full" />
          <div className="h-3 bg-neutral-200 rounded w-5/6" />
          <div className="h-3 bg-neutral-200 rounded w-1/3 mt-3" />
        </div>
      </div>
    </div>
  );
}

function MetricChart({
  title,
  data,
  chartConfig,
  dateRange,
  prefix = "",
  suffix = "",
  valueFormatter,
}: {
  title: string;
  data: TimeSeries;
  chartConfig: ChartConfig;
  dateRange: string;
  prefix?: string;
  suffix?: string;
  valueFormatter?: (value: number) => string;
}) {
  // Transform data for recharts
  const chartData = data.dates.map((date, dateIndex) => {
    const point: Record<string, string | number> = {
      date,
      displayDate: formatDate(date),
    };
    data.series.forEach((series) => {
      point[series.project_uuid] = series.data[dateIndex] || 0;
    });
    return point;
  });

  // Calculate date range for subtitle
  const startDate = data.dates[0];
  const endDate = data.dates[data.dates.length - 1];
  const dateSubtitle =
    startDate && endDate
      ? `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`
      : dateRange;

  const trendPercent = data.totals.trend_percent;
  const trendDirection = data.totals.trend_direction;
  const currentTotal = data.totals.current;

  // Format the display value
  const displayValue = valueFormatter
    ? valueFormatter(currentTotal)
    : `${prefix}${currentTotal.toLocaleString()}${suffix}`;

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4">
      <div className="mb-2">
        <h3 className="text-sm font-medium text-[#2E3238]">{title}</h3>
        <p className="text-xs text-base-400">{dateSubtitle}</p>
      </div>

      {data.series.length > 0 && chartData.length > 0 ? (
        <>
          <ChartContainer config={chartConfig} className="h-[120px] w-full">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                {data.series.map((series, index) => (
                  <linearGradient
                    key={series.project_uuid}
                    id={`fill-${series.project_uuid}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={PROJECT_COLORS[index % PROJECT_COLORS.length]}
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor={PROJECT_COLORS[index % PROJECT_COLORS.length]}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                ))}
              </defs>
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
                tickFormatter={(value) => {
                  if (valueFormatter) return valueFormatter(value);
                  return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString();
                }}
              />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(label) => label} />} />
              {data.series.map((series, index) => (
                <Area
                  key={series.project_uuid}
                  type="monotone"
                  dataKey={series.project_uuid}
                  stroke={PROJECT_COLORS[index % PROJECT_COLORS.length]}
                  strokeWidth={2}
                  fill={`url(#fill-${series.project_uuid})`}
                  fillOpacity={1}
                />
              ))}
            </AreaChart>
          </ChartContainer>

          {/* Trend indicator */}
          {trendDirection !== "flat" && (
            <p
              className={`text-xs mt-2 ${trendDirection === "up" ? "text-green-600" : "text-red-600"}`}
            >
              {trendDirection === "up" ? "↗" : "↘"}{" "}
              {trendDirection === "up" ? "Improved" : "Declined"} by {trendPercent.toFixed(1)}% vs
              previous period
            </p>
          )}
        </>
      ) : (
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
      )}
    </div>
  );
}

function ProjectFilterTabs({
  statusCounts,
  activeFilter,
  onFilterChange,
}: {
  statusCounts: StatusCounts;
  activeFilter: string;
  onFilterChange: (status: string) => void;
}) {
  const tabs: { key: string; label: string; count: number }[] = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "live", label: "Live", count: statusCounts.live },
    { key: "paused", label: "Paused", count: statusCounts.paused },
    { key: "draft", label: "Draft", count: statusCounts.draft },
  ];

  return (
    <div className="flex items-center gap-2 mb-4">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onFilterChange(tab.key)}
          className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
            activeFilter === tab.key
              ? "bg-[#2E3238] text-white border-[#2E3238]"
              : "bg-white text-base-600 border-neutral-300 hover:border-neutral-400"
          }`}
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const formatCurrency = (value: number | null | undefined) =>
    value != null ? `$${value.toFixed(2)}` : "-";
  const formatPercent = (value: number | null | undefined) =>
    value != null ? `${(value * 100).toFixed(1)}%` : "-";

  const statusBadge: Record<ProjectStatus, { label: string; className: string }> = {
    live: { label: "Live", className: "bg-green-100 text-green-700" },
    paused: { label: "Paused", className: "bg-yellow-100 text-yellow-700" },
    draft: { label: "Draft", className: "bg-neutral-100 text-neutral-600" },
  };

  const badge = statusBadge[project.status];

  return (
    <Link
      href={`/projects/${project.uuid}/website`}
      className="block rounded-lg border border-neutral-300 bg-white p-4 hover:border-neutral-400 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-center gap-4">
        {/* Thumbnail */}
        <div className="w-[140px] h-[90px] flex-shrink-0 rounded-md bg-neutral-100 overflow-hidden">
          {project.thumbnail_url ? (
            <img
              src={project.thumbnail_url}
              alt={project.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                className="text-neutral-300"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                <path
                  d="M21 15L16 10L5 21"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Project info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-[#2E3238] truncate">{project.name}</h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          {project.url ? (
            <a
              href={project.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-base-500 hover:text-base-700 hover:underline inline-flex items-center gap-1"
            >
              {project.url.replace("https://", "")}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-60">
                <path
                  d="M9 6.5V9.5C9 10.0523 8.55228 10.5 8 10.5H2.5C1.94772 10.5 1.5 10.0523 1.5 9.5V4C1.5 3.44772 1.94772 3 2.5 3H5.5"
                  stroke="currentColor"
                  strokeLinecap="round"
                />
                <path
                  d="M7 1.5H10.5V5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path d="M10.5 1.5L5.5 6.5" stroke="currentColor" strokeLinecap="round" />
              </svg>
            </a>
          ) : (
            <span className="text-sm text-base-400">No site connected</span>
          )}
        </div>

        {/* Metrics */}
        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <div className="text-base-500 text-xs">Leads</div>
            <div className="font-medium">{project.total_leads}</div>
          </div>
          <div className="text-center">
            <div className="text-base-500 text-xs">Page Views</div>
            <div className="font-medium">{project.total_page_views}</div>
          </div>
          <div className="text-center">
            <div className="text-base-500 text-xs">CTR</div>
            <div className="font-medium">{formatPercent(project.ctr)}</div>
          </div>
          <div className="text-center">
            <div className="text-base-500 text-xs">Cost-per-Lead</div>
            <div className="font-medium">{formatCurrency(project.cpl)}</div>
          </div>
          <div className="text-center">
            <div className="text-base-500 text-xs">Total Spend</div>
            <div className="font-medium">${project.cost_dollars.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateShort(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
