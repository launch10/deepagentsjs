import { cn } from "@lib/utils";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";
import { Spinner } from "@components/ui/spinner";

export type TodoItemStatus = "completed" | "in_progress" | "pending";

export interface CreateFlowTodoItemProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  status: TodoItemStatus;
}

export default function CreateFlowTodoItem({ icon: Icon, label, status }: CreateFlowTodoItemProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between h-10 px-3 rounded-lg border border-neutral-300",
        status === "pending" ? "bg-neutral-50" : "bg-white"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
        <Icon className={cn("size-4 shrink-0", status === "pending" ? "text-base-400" : "text-base-500")} />
        <span className={cn("text-xs", status === "pending" ? "text-base-400" : "text-base-500")}>
          {label}
        </span>
      </div>
      <div className="size-6 shrink-0 flex items-center justify-center">
        {status === "completed" && <CheckCircleIcon className="size-6 text-success-500" />}
        {status === "in_progress" && <Spinner className="size-4" />}
      </div>
    </div>
  );
}
