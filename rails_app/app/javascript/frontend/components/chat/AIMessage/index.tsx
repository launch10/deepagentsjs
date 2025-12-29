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

// Loading component
export interface AIMessageLoadingProps {
  className?: string;
}

function Loading({ className }: AIMessageLoadingProps) {
  return (
    <div className={twMerge("flex items-center gap-2", className)}>
      <div className="flex gap-1">
        <span
          className="w-2 h-2 bg-base-300 rounded-full animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="w-2 h-2 bg-base-300 rounded-full animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="w-2 h-2 bg-base-300 rounded-full animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}

// Export as compound component
export const AIMessage = {
  Content,
  Bubble,
  Loading,
};
