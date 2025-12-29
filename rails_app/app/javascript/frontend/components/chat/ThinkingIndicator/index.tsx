import { twMerge } from "tailwind-merge";
import type { HTMLAttributes } from "react";

export type ThinkingIndicatorVariant = "default" | "bubble";

export interface ThinkingIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  text?: string;
  stage?: string;
  variant?: ThinkingIndicatorVariant;
  className?: string;
}

export function ThinkingIndicator({
  text = "Thinking",
  stage,
  variant = "default",
  className,
  ...props
}: ThinkingIndicatorProps) {
  return (
    <div
      className={twMerge(
        "flex flex-col gap-1",
        variant === "bubble" && "bg-base-200 rounded-2xl px-4 py-3 max-w-[80%]",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-500">{text}</span>
        <div className="flex gap-1">
          <span
            className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
      {stage && <span className="text-xs text-neutral-400">{stage}</span>}
    </div>
  );
}
