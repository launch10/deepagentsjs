import { useState, useMemo, useEffect, useCallback } from "react";
import { usePage } from "@inertiajs/react";
import { Link } from "@inertiajs/react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";
import { ProjectCard } from "@components/projects/ProjectCard";
import { ProjectsPagination } from "@components/projects/ProjectsPagination";
import { cn } from "@lib/utils";
import { useProjects } from "~/api";
import type { InertiaProps } from "@shared";
import type { ProjectMini, StatusCounts, ProjectsListResponse } from "@rails_api_base";

type ProjectsPageProps =
  InertiaProps.paths["/projects"]["get"]["responses"]["200"]["content"]["application/json"];
type Project = ProjectsPageProps["projects"][number];
type ProjectStatus = Project["status"];
type FilterStatus = "all" | ProjectStatus;

const FILTERS: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "all" },
  { label: "Live", value: "live" },
  { label: "Paused", value: "paused" },
  { label: "Draft", value: "draft" },
];

const STATUS_ORDER: Record<ProjectStatus, number> = {
  live: 0,
  paused: 1,
  draft: 2,
};

export default function Projects() {
  const inertiaProps = usePage<ProjectsPageProps>().props;

  // Get initial page from URL or default to 1
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return Number(params.get("page")) || 1;
    }
    return 1;
  });

  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");
  const statusFilter = activeFilter !== "all" ? activeFilter : undefined;

  // Convert Inertia props to React Query format for initialData
  const inertiaAsQueryData: ProjectsListResponse = useMemo(
    () => ({
      projects: inertiaProps.projects as ProjectMini[],
      pagination: inertiaProps.pagination as ProjectsListResponse["pagination"],
      status_counts:
        (inertiaProps as ProjectsPageProps & { status_counts: StatusCounts }).status_counts ?? {},
    }),
    [inertiaProps]
  );

  // Always use React Query, seeded with Inertia data for page 1 with no filter
  const isInitialPageWithNoFilter = currentPage === 1 && !statusFilter;

  const { data, isFetching } = useProjects(
    { page: currentPage, status: statusFilter, prefetchAdjacent: true },
    {
      // Seed with Inertia data for initial page load
      initialData: isInitialPageWithNoFilter ? inertiaAsQueryData : undefined,
      // Keep previous data while fetching to prevent flicker
      placeholderData: (previousData) => previousData,
    }
  );

  // Extract data with fallback
  const projects = data?.projects ?? [];
  const pagination = data?.pagination ?? inertiaAsQueryData.pagination;
  const apiStatusCounts = data?.status_counts ?? {};

  // Sort by status for display
  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [projects]);

  // Status counts for filter badges (derived from API response)
  const statusCounts = useMemo(() => {
    const counts: Record<FilterStatus, number> = {
      all:
        (apiStatusCounts.draft ?? 0) + (apiStatusCounts.paused ?? 0) + (apiStatusCounts.live ?? 0),
      live: apiStatusCounts.live ?? 0,
      paused: apiStatusCounts.paused ?? 0,
      draft: apiStatusCounts.draft ?? 0,
    };
    return counts;
  }, [apiStatusCounts]);

  // Handle page change - update URL and state
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);

    // Update URL without full page reload
    const url = new URL(window.location.href);
    if (page === 1) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", String(page));
    }
    window.history.pushState({}, "", url.toString());
  }, []);

  // Handle filter change - reset to page 1
  const handleFilterChange = useCallback((filter: FilterStatus) => {
    setActiveFilter(filter);
    setCurrentPage(1);

    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.delete("page");
    window.history.pushState({}, "", url.toString());
  }, []);

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setCurrentPage(Number(params.get("page")) || 1);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Show empty state only if no projects at all (page 1, no filter, no data)
  if (projects.length === 0 && isInitialPageWithNoFilter && !isFetching) {
    return (
      <div className="flex flex-col h-full px-8 pt-12">
        <div>
          <h1 className="font-serif text-[28px] font-semibold leading-8 text-base-500">
            Your Projects
          </h1>
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-8 pt-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-[28px] font-semibold leading-8 text-base-500">
            Your Projects
          </h1>
          <p
            data-testid="projects-total-count"
            data-count={pagination.total_count}
            className="mt-2 font-sans text-lg leading-[22px] text-base-400/70"
          >
            {pagination.total_count} total project{pagination.total_count !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <PlusIcon className="w-4 h-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Segmented filter control */}
      <div className="mt-8 flex items-center">
        <div className="bg-neutral-100 rounded-full p-1 flex items-center">
          {FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleFilterChange(value)}
              className={cn(
                "rounded-full px-2 py-0.5 flex items-center gap-1 transition-colors",
                activeFilter === value ? "bg-white shadow-sm" : "hover:bg-neutral-200/50"
              )}
            >
              <span
                className={cn(
                  "font-sans text-sm leading-[18px]",
                  activeFilter === value ? "text-base-600" : "text-neutral-600"
                )}
              >
                {label}
              </span>
              <span className="font-sans text-xs leading-4 text-neutral-600">
                ({statusCounts[value]})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Project list */}
      <div
        data-testid="projects-list"
        data-loading={isFetching}
        className={cn("flex flex-col gap-5 mt-6", isFetching && "opacity-60 transition-opacity")}
      >
        {sortedProjects.length === 0 ? (
          <div className="py-8 text-center text-base-400">No projects found</div>
        ) : (
          sortedProjects.map((project) => <ProjectCard key={project.id} project={project} />)
        )}
      </div>

      {/* Pagination */}
      {pagination.total_pages > 1 && (
        <ProjectsPagination
          pagination={pagination}
          onPageChange={handlePageChange}
          disabled={isFetching}
        />
      )}

      {/* Bottom spacing */}
      <div className="pb-8" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5">
      <img src="/images/empty-folder.png" alt="No projects" className="w-[175px] h-[175px]" />
      <div className="flex flex-col items-center gap-3">
        <h2 className="font-sans text-lg font-semibold leading-[22px] text-base-500">
          No projects yet
        </h2>
        <p className="font-sans text-base leading-5 text-base-300 text-center max-w-[406px]">
          Create your first landing page and ad campaign to start acquiring customers in minutes
        </p>
      </div>
      <Button asChild>
        <Link href="/projects/new">
          <PlusIcon className="w-4 h-4" />
          Create Your First Project
        </Link>
      </Button>
    </div>
  );
}
