import { cn } from "@lib/utils";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import type { ComponentType, SVGProps } from "react";
import { Spinner } from "@components/ui/spinner";

export type LoadingStepStatus = "completed" | "in_progress" | "pending";

export interface LoadingStepPillProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  status: LoadingStepStatus;
}

export default function LoadingStepPill({ icon: Icon, label, status }: LoadingStepPillProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between h-10 px-3 rounded-lg border border-neutral-300",
        status === "pending" ? "bg-neutral-50" : "bg-white"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("size-4", status === "pending" ? "text-base-400" : "text-base-500")} />
        <span className={cn("text-xs", status === "pending" ? "text-base-400" : "text-base-500")}>
          {label}
        </span>
      </div>
      <div className="size-6 flex items-center justify-center">
        {status === "completed" && <CheckCircleIcon className="size-6 text-success-500" />}
        {status === "in_progress" && <Spinner className="size-4" />}
      </div>
    </div>
  );
}
