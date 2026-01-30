import { useState } from "react";
import { Link, router } from "@inertiajs/react";
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
import type { InertiaProps } from "@shared";

type ProjectsPageProps =
  InertiaProps.paths["/projects"]["get"]["responses"]["200"]["content"]["application/json"];
type Project = ProjectsPageProps["projects"][number];
type ProjectStatus = Project["status"];

const STATUS_STYLES: Record<ProjectStatus, string> = {
  live: "bg-success-100 text-success-700",
  paused: "bg-accent-yellow-100 text-accent-yellow-700",
  draft: "bg-neutral-100 text-base-600",
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  live: "Live",
  paused: "Paused",
  draft: "Draft",
};

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const isLive = project.status === "live";
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = () => {
    setIsDeleting(true);
    router.delete(`/projects/${project.uuid}`, {
      onSuccess: () => {
        setDeleteOpen(false);
      },
      onError: () => {
        setIsDeleting(false);
      },
    });
  };

  return (
    <>
    <div className="bg-white rounded-2xl border border-neutral-300 flex">
      {/* Thumbnail placeholder */}
      <div className="w-[180px] shrink-0 bg-neutral-50 rounded-l-2xl flex items-center justify-center">
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
                className="font-sans text-sm leading-[18px] text-primary-500 underline truncate"
              >
                https://{project.domain}
              </a>
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-primary-500 shrink-0" />
            </div>
          ) : (
            <p className="font-sans text-sm leading-[18px] text-neutral-500">No site connected</p>
          )}

          {/* Timestamps */}
          <div className="flex items-center gap-[18px]">
            {project.updated_at != null && (
              <div className="flex items-center gap-1">
                <ClockIcon className="w-3.5 h-3.5 text-neutral-500" />
                <span className="font-sans text-xs leading-4 text-neutral-500">
                  Edited {formatDistanceToNow(new Date(project.updated_at as string), { addSuffix: true })}
                </span>
              </div>
            )}
            {project.created_at != null && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-3.5 text-neutral-500" />
                <span className="font-sans text-xs leading-4 text-neutral-500">
                  Created {formatDistanceToNow(new Date(project.created_at as string), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 ml-5">
          {isLive ? (
            <Link
              href={`/projects/${project.uuid}/leads`}
              className="bg-neutral-background border border-neutral-300 rounded-lg px-3 py-2 text-sm leading-[18px] text-base-500 flex items-center gap-2 hover:bg-neutral-100 transition-colors"
            >
              <UsersIcon className="w-4 h-4 text-base-600" />
              Customer Leads
            </Link>
          ) : (
            <button
              disabled
              className="bg-neutral-200 border border-neutral-500 rounded-lg px-3 py-2 text-sm leading-[18px] text-neutral-500 flex items-center gap-2 cursor-not-allowed"
            >
              <UsersIcon className="w-4 h-4 text-neutral-500" />
              Customer Leads
            </button>
          )}
          {isLive ? (
            <button
              disabled
              className="bg-neutral-background border border-neutral-300 rounded-lg px-3 py-2 text-sm leading-[18px] text-base-500 flex items-center gap-2 cursor-not-allowed"
            >
              <ChartBarIcon className="w-4 h-4 text-base-600" />
              Performance
            </button>
          ) : (
            <button
              disabled
              className="bg-neutral-200 border border-neutral-500 rounded-lg px-3 py-2 text-sm leading-[18px] text-neutral-500 flex items-center gap-2 cursor-not-allowed"
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
              className="w-[149px] p-2 rounded-lg border-neutral-100 shadow-sm"
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
                className="px-4 py-3 rounded-lg text-sm font-sans text-error-500 cursor-pointer focus:text-error-500"
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
        className="w-[600px] max-w-[600px] p-8 rounded-lg border-neutral-200 shadow-sm"
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
          <div className="w-[100px] h-[72px] shrink-0 bg-neutral-50 rounded-lg flex items-center justify-center">
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
            onClick={handleDelete}
            disabled={isDeleting}
            className="font-sans text-sm font-semibold text-error-500 px-4 py-2 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? "Deleting..." : "Delete Project"}
          </button>
          <button
            onClick={() => setDeleteOpen(false)}
            disabled={isDeleting}
            className="font-sans text-sm font-semibold text-white bg-base-600 rounded-lg px-5 py-2.5 hover:bg-base-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Keep Project
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
