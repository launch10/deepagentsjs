import { useState } from "react";
import { Link } from "@inertiajs/react";
import {
  PhotoIcon,
  ClockIcon,
  CalendarIcon,
  ArrowTopRightOnSquareIcon,
  UsersIcon,
  ChartBarIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@components/ui/dropdown-menu";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@components/ui/dialog";
import { XMarkIcon } from "@heroicons/react/24/outline";

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
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
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

          {/* Three-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 text-base-400 hover:text-base-600 transition-colors shrink-0">
                <EllipsisVerticalIcon className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[149px] p-2 rounded-lg border-[#EDEDEC] shadow-[0px_4px_4px_-1px_rgba(12,12,13,0.1),0px_4px_4px_-1px_rgba(12,12,13,0.05)]"
            >
              {/* TODO: Link to campaign edit page for this project */}
              <DropdownMenuItem className="px-4 py-3 rounded-lg text-sm font-sans text-base-600 cursor-pointer">
                Edit Campaign
              </DropdownMenuItem>
              {/* TODO: Link to website builder/editor for this project */}
              <DropdownMenuItem className="px-4 py-3 rounded-lg text-sm font-sans text-base-600 cursor-pointer">
                Edit Page
              </DropdownMenuItem>
              <DropdownMenuItem
                className="px-4 py-3 rounded-lg text-sm font-sans text-[#D14F34] cursor-pointer focus:text-[#D14F34]"
                onSelect={() => setDeleteOpen(true)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>

    {/* Delete confirmation modal */}
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <DialogContent
        hideCloseButton
        className="w-[600px] max-w-[600px] p-8 rounded-lg border-[#E2E1E0] shadow-[0px_4px_4px_-1px_rgba(12,12,13,0.1),0px_4px_4px_-1px_rgba(12,12,13,0.05)]"
      >
        <DialogClose className="absolute right-4 top-4 rounded-sm text-base-400 hover:text-base-600 transition-opacity focus:outline-none">
          <XMarkIcon className="h-5 w-5" />
          <span className="sr-only">Close</span>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="font-sans text-xl font-semibold text-base-600">
            Delete this project?
          </DialogTitle>
          <DialogDescription className="font-sans text-sm text-base-400 mt-1">
            This will permanently delete your landing page, ad campaign data, and all
            associated leads. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Project preview card */}
        <div className="border border-neutral-300 rounded-lg p-5 flex items-center gap-4 mt-2">
          <div className="w-[100px] h-[72px] shrink-0 bg-[#F8F8F8] rounded-lg flex items-center justify-center">
            <PhotoIcon className="w-8 h-8 text-base-400" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <span className="font-sans text-base font-semibold text-base-600 truncate">
              {project.name}
            </span>
            {project.domain ? (
              <span className="font-sans text-sm text-neutral-500 truncate">
                https://{project.domain}
              </span>
            ) : (
              <span className="font-sans text-sm text-neutral-500">
                No site connected
              </span>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex items-center justify-end gap-3 mt-4">
          <button
            onClick={() => {
              // TODO: Implement delete project (frontend + backend + toast)
              console.log("Delete project:", project.uuid);
            }}
            className="font-sans text-sm font-semibold text-[#D14F34] px-4 py-2 hover:underline"
          >
            Delete Project
          </button>
          <button
            onClick={() => setDeleteOpen(false)}
            className="font-sans text-sm font-semibold text-white bg-base-600 rounded-lg px-5 py-2.5 hover:bg-base-500 transition-colors"
          >
            Keep Project
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
