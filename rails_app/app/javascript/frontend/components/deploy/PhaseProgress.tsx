/**
 * PhaseProgress - Displays deploy phases with status indicators
 *
 * Shows the high-level phases (not granular tasks) to the user.
 * Each phase shows its name, description, and current status.
 *
 * Phase statuses:
 * - pending: Not started yet (gray)
 * - running: In progress (blue with animation)
 * - completed: Successfully finished (green)
 * - failed: Error occurred (red)
 */

import { cn } from "@lib/utils";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";

export interface Phase {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  error?: string;
}

interface PhaseProgressProps {
  /** Array of phases to display */
  phases: Phase[];
  /** Optional className for the container */
  className?: string;
  /** Whether to show only active phases (hide pending phases) */
  showOnlyActive?: boolean;
}

function PhaseStatusIcon({ status }: { status: Phase["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "running":
      return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "pending":
    default:
      return <Circle className="h-5 w-5 text-gray-300" />;
  }
}

function PhaseItem({ phase }: { phase: Phase }) {
  const statusColors = {
    pending: "text-gray-400",
    running: "text-blue-600",
    completed: "text-green-600",
    failed: "text-red-600",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
        phase.status === "running" && "bg-blue-50",
        phase.status === "failed" && "bg-red-50"
      )}
      data-testid={`phase-${phase.name}`}
      data-status={phase.status}
    >
      <PhaseStatusIcon status={phase.status} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", statusColors[phase.status])}>{phase.description}</p>
        {phase.error && phase.status === "failed" && (
          <p className="text-xs text-red-500 mt-0.5 truncate">{phase.error}</p>
        )}
      </div>
      {phase.status === "running" && phase.progress > 0 && phase.progress < 1 && (
        <span className="text-xs text-blue-500">{Math.round(phase.progress * 100)}%</span>
      )}
    </div>
  );
}

export function PhaseProgress({ phases, className, showOnlyActive = false }: PhaseProgressProps) {
  const displayPhases = showOnlyActive
    ? phases.filter((p) => p.status !== "pending" || p.progress > 0)
    : phases;

  if (displayPhases.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-1", className)} data-testid="phase-progress">
      {displayPhases.map((phase) => (
        <PhaseItem key={phase.id} phase={phase} />
      ))}
    </div>
  );
}

export default PhaseProgress;
