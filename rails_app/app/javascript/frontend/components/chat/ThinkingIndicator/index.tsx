import { twMerge } from "tailwind-merge";
import type { HTMLAttributes } from "react";
import { Rocket } from "lucide-react";

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
      role="status"
      data-testid="thinking-indicator"
      aria-label={text}
      className={twMerge(
        "flex flex-col gap-1",
        variant === "bubble" && "bg-base-200 rounded-2xl px-4 py-3 max-w-[80%]",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {/* Rocket icon with spinning circle */}
        <div className="relative w-[34px] h-[34px]">
          {/* Spinning circle */}
          <svg
            className="absolute inset-0 w-full h-full animate-spin"
            viewBox="0 0 34 34"
            fill="none"
          >
            <circle cx="17" cy="17" r="15" stroke="#E2E1E0" strokeWidth="2" strokeLinecap="round" />
            <circle
              cx="17"
              cy="17"
              r="15"
              stroke="#3748B8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="94.2"
              strokeDashoffset="70"
            />
          </svg>
          {/* Rocket icon centered */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Rocket className="w-[18px] h-[18px] text-primary-700" strokeWidth={1.5} />
          </div>
        </div>
        <span className="text-sm text-base-400 italic">{text}...</span>
      </div>
      {stage && <span className="text-xs text-neutral-400">{stage}</span>}
    </div>
  );
}
