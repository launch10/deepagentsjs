import { twMerge } from "tailwind-merge";

interface QuestionBadgeProps {
  current: number;
  total: number;
  className?: string;
}

/**
 * Displays "Question X of Y" badge with purple styling
 * Matches Figma design: light purple background, primary-300 border, rounded-xl
 */
export function QuestionBadge({ current, total, className }: QuestionBadgeProps) {
  return (
    <div
      className={twMerge(
        "inline-flex items-center justify-center px-5 py-3 h-[42px]",
        "bg-[rgba(215,218,241,0.16)] border border-primary-300 rounded-3xl",
        className
      )}
    >
      <span className="text-sm font-medium text-base-600">
        Question {current} of {total}
      </span>
    </div>
  );
}
