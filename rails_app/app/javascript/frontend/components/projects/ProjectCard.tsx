import { Link } from "@inertiajs/react";
import {
  PhotoIcon,
  ClockIcon,
  CalendarIcon,
  ArrowTopRightOnSquareIcon,
  UsersIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@lib/utils";

type ProjectStatus = "live" | "paused" | "draft";

const STATUS_STYLES: Record<ProjectStatus, string> = {
  live: "bg-[#D9F4E9] text-[#1F694C]",
  paused: "bg-[#FAECDB] text-[#BF873F]",
  draft: "bg-[#EDEDEC] text-base-600",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  live: "Live",
  paused: "Paused",
  draft: "Draft",
};

interface ProjectCardProps {
  project: {
    uuid: string;
    name: string;
    status: ProjectStatus;
    domain: string | null;
    created_at: string;
    updated_at: string;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const isLive = project.status === "live";

  return (
    <div className="bg-white rounded-2xl border border-neutral-300 flex">
      {/* Thumbnail placeholder */}
      <div className="w-[180px] shrink-0 bg-[#F8F8F8] rounded-l-2xl flex items-center justify-center">
        <PhotoIcon className="w-8 h-8 text-base-400" />
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 p-5 flex items-center">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Name + status tag */}
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-lg font-semibold leading-[22px] text-base-600 truncate">
              {project.name}
            </h3>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs leading-4 shrink-0",
                STATUS_STYLES[project.status],
              )}
            >
              {STATUS_LABELS[project.status]}
            </span>
          </div>

          {/* URL */}
          {project.domain ? (
            <div className="flex items-end gap-2">
              <a
                href={`https://${project.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-sans text-sm leading-[18px] text-[#3748B8] underline truncate"
              >
                https://{project.domain}
              </a>
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-[#3748B8] shrink-0" />
            </div>
          ) : (
            <p className="font-sans text-sm leading-[18px] text-neutral-500">No site connected</p>
          )}

          {/* Timestamps */}
          <div className="flex items-center gap-[18px]">
            <div className="flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5 text-neutral-500" />
              <span className="font-sans text-xs leading-4 text-neutral-500">
                Edited {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <CalendarIcon className="w-4 h-3.5 text-neutral-500" />
              <span className="font-sans text-xs leading-4 text-neutral-500">
                Created {formatDistanceToNow(new Date(project.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 ml-5">
          {isLive ? (
            <Link
              href={`/projects/${project.uuid}/leads`}
              className="bg-[#FAFAF9] border border-neutral-300 rounded-lg px-3 py-2 text-sm leading-[18px] text-base-500 flex items-center gap-2 hover:bg-neutral-100 transition-colors"
            >
              <UsersIcon className="w-4 h-4 text-base-600" />
              Customer Leads
            </Link>
          ) : (
            <button
              disabled
              className="bg-[#E2E1E0] border border-neutral-500 rounded-lg px-3 py-2 text-sm leading-[18px] text-neutral-500 flex items-center gap-2 cursor-not-allowed"
            >
              <UsersIcon className="w-4 h-4 text-neutral-500" />
              Customer Leads
            </button>
          )}
          {isLive ? (
            <button
              disabled
              className="bg-[#FAFAF9] border border-neutral-300 rounded-lg px-3 py-2 text-sm leading-[18px] text-base-500 flex items-center gap-2 cursor-not-allowed"
            >
              <ChartBarIcon className="w-4 h-4 text-base-600" />
              Performance
            </button>
          ) : (
            <button
              disabled
              className="bg-[#E2E1E0] border border-neutral-500 rounded-lg px-3 py-2 text-sm leading-[18px] text-neutral-500 flex items-center gap-2 cursor-not-allowed"
            >
              <ChartBarIcon className="w-4 h-4 text-neutral-500" />
              Performance
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
