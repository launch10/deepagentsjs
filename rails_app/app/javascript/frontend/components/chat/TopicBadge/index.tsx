import { twMerge } from "tailwind-merge";

export type TopicBadgeVariant = "active" | "completed" | "pending";

export interface TopicBadgeProps {
  topic: string;
  variant?: TopicBadgeVariant;
  className?: string;
}

const variantStyles: Record<TopicBadgeVariant, string> = {
  active: "bg-primary-100 text-primary-700",
  completed: "bg-success-100 text-success-700",
  pending: "bg-neutral-100 text-neutral-600",
};

export function TopicBadge({ topic, variant = "active", className }: TopicBadgeProps) {
  return (
    <div
      className={twMerge(
        "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
        variantStyles[variant],
        className
      )}
    >
      {topic}
    </div>
  );
}
