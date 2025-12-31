import { twMerge } from "tailwind-merge";
import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";

// Content component - renders markdown
export interface AIMessageContentProps {
  children: ReactNode;
  state?: "active" | "inactive" | "loading";
  className?: string;
}

function Content({ children, state = "active", className }: AIMessageContentProps) {
  return (
    <div
      className={twMerge(
        "text-sm prose prose-sm max-w-none",
        state === "inactive" && "text-base-300",
        className
      )}
    >
      {typeof children === "string" ? <ReactMarkdown>{children}</ReactMarkdown> : children}
    </div>
  );
}

// Bubble wrapper - optional bubble styling
export interface AIMessageBubbleProps {
  children: ReactNode;
  className?: string;
}

function Bubble({ children, className }: AIMessageBubbleProps) {
  return (
    <div className={twMerge("bg-base-200 rounded-2xl px-4 py-3 max-w-[80%]", className)}>
      {children}
    </div>
  );
}

// Export as compound component
// Note: AIMessage.Loading was removed - use ThinkingIndicator instead
export const AIMessage = {
  Content,
  Bubble,
};
