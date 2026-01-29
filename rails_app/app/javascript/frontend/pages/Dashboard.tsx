import { usePage } from "@inertiajs/react";

// Types based on DashboardController props - matches Analytics::Metrics::BaseMetric output
interface SeriesData {
  project_id: number;
  project_uuid: string;
  project_name: string;
  data: number[];
}

interface TimeSeries {
  dates: string[];
  series: SeriesData[];
  totals: {
    current: number;
    previous: number;
    trend_percent: number;
    trend_direction: "up" | "down" | "flat";
  };
}

interface Insight {
  title: string;
  description: string;
  sentiment: "positive" | "negative" | "neutral";
  project_uuid: string | null;
  action: {
    label: string;
    url: string;
  };
}

interface ProjectSummary {
  id: number;
  uuid: string;
  name: string;
  total_leads: number;
  total_unique_visitors: number;
  total_page_views: number;
  total_impressions: number;
  total_clicks: number;
  ctr: number | null;
  cost_dollars: number;
  cpl: number | null;
}

interface DateRangeOption {
  label: string;
  days: number;
}

interface DashboardProps {
  performance: {
    leads: TimeSeries;
    unique_visitors: TimeSeries;
    page_views: TimeSeries;
    ctr: TimeSeries;
    cpl: TimeSeries;
  };
  projects: ProjectSummary[];
  date_range: string;
  days: number;
  status_filter: string;
  date_range_options: DateRangeOption[];
  insights: Insight[] | null;
  metrics_summary: Record<string, unknown> | null;
  // current_user comes from inertia_share in SubscribedController
  current_user: {
    id: number;
    name: string;
    email: string;
    admin: boolean;
  } | null;
}

export default function Dashboard() {
  const { performance, projects, date_range, insights, current_user } =
    usePage<DashboardProps>().props;

  const firstName = current_user?.name?.split(" ")[0] || "there";

  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <div className="px-4 py-6 lg:px-12 lg:py-10 max-w-[1200px]">
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
        {insights && insights.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-[#2E3238] mb-4">Key Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {insights.map((insight, index) => (
                <InsightCard key={index} insight={insight} />
              ))}
            </div>
          </section>
        )}

        {/* Performance Overview */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#2E3238]">Performance Overview</h2>
            <span className="text-sm text-base-500">{date_range}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Total Leads" data={performance?.leads} />
            <MetricCard title="Cost-per-Lead" data={performance?.cpl} prefix="$" />
            <MetricCard
              title="Click-Through Rate"
              data={performance?.ctr}
              suffix="%"
              multiplier={100}
            />
            <MetricCard title="Page Views" data={performance?.page_views} />
          </div>
        </section>

        {/* Projects */}
        <section>
          <h2 className="text-lg font-semibold text-[#2E3238] mb-4">Projects</h2>
          {projects && projects.length > 0 ? (
            <div className="space-y-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-neutral-300 bg-white p-8 text-center">
              <p className="text-base-500">
                No projects yet. Create your first project to get started.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const sentimentColors = {
    positive: "border-green-200 bg-green-50",
    negative: "border-red-200 bg-red-50",
    neutral: "border-blue-200 bg-blue-50",
  };

  const titleColors = {
    positive: "text-green-700",
    negative: "text-red-700",
    neutral: "text-blue-700",
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

function MetricCard({
  title,
  data,
  prefix = "",
  suffix = "",
  multiplier = 1,
}: {
  title: string;
  data: TimeSeries | undefined;
  prefix?: string;
  suffix?: string;
  multiplier?: number;
}) {
  // Handle missing data gracefully
  if (!data?.totals) {
    return (
      <div className="rounded-lg border border-neutral-300 bg-white p-4">
        <h3 className="text-sm text-base-500 mb-1">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-[#2E3238]">-</span>
        </div>
      </div>
    );
  }

  const currentTotal = data.totals.current ?? 0;
  const displayValue = (currentTotal * multiplier).toFixed(suffix === "%" ? 1 : 0);
  const trendPercent = data.totals.trend_percent;
  const trendDirection = data.totals.trend_direction;

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4">
      <h3 className="text-sm text-base-500 mb-1">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-[#2E3238]">
          {prefix}
          {displayValue}
          {suffix}
        </span>
        {trendPercent !== undefined && trendDirection !== "flat" && (
          <span
            className={`text-xs font-medium ${
              trendDirection === "up" ? "text-green-600" : "text-red-600"
            }`}
          >
            {trendDirection === "up" ? "+" : "-"}
            {trendPercent.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const formatCurrency = (value: number | null) => (value !== null ? `$${value.toFixed(2)}` : "-");
  const formatPercent = (value: number | null) =>
    value !== null ? `${(value * 100).toFixed(1)}%` : "-";

  return (
    <div className="rounded-lg border border-neutral-300 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#2E3238]">{project.name}</h3>
        </div>
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
    </div>
  );
}
