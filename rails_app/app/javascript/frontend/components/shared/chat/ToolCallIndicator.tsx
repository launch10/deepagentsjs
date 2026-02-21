import { twMerge } from "tailwind-merge";

export interface ToolCallIndicatorProps {
  toolName: string;
  state: "running" | "complete" | "error";
  className?: string;
}

/**
 * Human-friendly labels for tool names.
 * Falls back to a formatted version of the raw name.
 */
const TOOL_LABELS: Record<string, string> = {
  save_answers: "Saving your answers",
  query_uploads: "Looking at your images",
  navigateTool: "Navigating",
  set_logo: "Setting your logo",
  save_social_links: "Saving social links",
  upload_project_images: "Uploading images",
  change_color_scheme: "Updating colors",
};

function labelForTool(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, " ");
}

/**
 * Compact inline indicator shown when the agent is executing a tool call.
 * Only renders in "running" state — completed/errored calls are silent.
 */
export function ToolCallIndicator({ toolName, state, className }: ToolCallIndicatorProps) {
  if (state !== "running") return null;

  return (
    <div
      className={twMerge("flex items-center gap-2 py-1 text-sm text-base-400 italic", className)}
      role="status"
      aria-label={`Running: ${labelForTool(toolName)}`}
    >
      <span className="inline-block h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
      <span>{labelForTool(toolName)}...</span>
    </div>
  );
}
