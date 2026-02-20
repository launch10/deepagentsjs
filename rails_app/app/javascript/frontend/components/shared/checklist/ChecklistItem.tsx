import { cn } from "@lib/utils";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";
import { Spinner } from "@components/ui/spinner";

export type ChecklistItemStatus = "completed" | "in_progress" | "running" | "pending";

export interface ChecklistItemProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  status: ChecklistItemStatus;
}

/**
 * A single checklist item: icon + label + status indicator.
 * Used by both CreateFlowTodoList (website build todos) and DeployTaskList (deploy tasks).
 */
export default function ChecklistItem({ icon: Icon, label, status }: ChecklistItemProps) {
  const isActive = status === "in_progress" || status === "running";
  const isDone = status === "completed";
  const isPending = status === "pending";

  return (
    <div
      data-testid={`checklist-item-${label}`}
      data-status={status}
      className={cn(
        "flex items-center justify-between min-h-10 px-3 py-2 rounded-lg border border-neutral-300",
        isPending ? "bg-neutral-50" : "bg-white"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
        <Icon className={cn("size-4 shrink-0", isPending ? "text-base-400" : "text-base-500")} />
        <span className={cn("text-xs", isPending ? "text-base-400" : "text-base-500")}>
          {label}
        </span>
      </div>
      <div className="size-6 shrink-0 flex items-center justify-center">
        {isDone && <CheckCircleIcon className="size-6 text-success-500" />}
        {isActive && <Spinner className="size-4" />}
      </div>
    </div>
  );
}
