import { useState, useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { Link } from "@inertiajs/react";
import { PlusIcon } from "@heroicons/react/24/outline";
import { Button } from "@components/ui/button";
import { ProjectCard } from "@components/projects/ProjectCard";
import { cn } from "@lib/utils";
import type { InertiaProps } from "@shared";

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
  const { projects, total_count } = usePage<ProjectsPageProps>().props;
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");

  const filteredProjects = useMemo(() => {
    const list = activeFilter === "all"
      ? projects
      : projects.filter((p) => p.status === activeFilter);
    return [...list].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [projects, activeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<FilterStatus, number> = {
      all: projects.length,
      live: 0,
      paused: 0,
      draft: 0,
    };
    for (const p of projects) {
      counts[p.status]++;
    }
    return counts;
  }, [projects]);

  if (projects.length === 0) {
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
          <p className="mt-2 font-sans text-lg leading-[22px] text-base-400/70">
            {total_count} total project{total_count !== 1 ? "s" : ""}
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
        <div className="bg-[#EDEDEC] rounded-full p-1 flex items-center">
          {FILTERS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setActiveFilter(value)}
              className={cn(
                "rounded-full px-2 py-0.5 flex items-center gap-1 transition-colors",
                activeFilter === value
                  ? "bg-white shadow-sm"
                  : "hover:bg-neutral-200/50",
              )}
            >
              <span
                className={cn(
                  "font-sans text-sm leading-[18px]",
                  activeFilter === value ? "text-base-600" : "text-[#8B8986]",
                )}
              >
                {label}
              </span>
              <span className="font-sans text-xs leading-4 text-[#8B8986]">
                ({statusCounts[value]})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Project list */}
      <div className="flex flex-col gap-5 mt-6 pb-8">
        {filteredProjects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
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
