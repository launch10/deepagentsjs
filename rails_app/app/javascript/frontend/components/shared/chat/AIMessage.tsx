import { twMerge } from "tailwind-merge";
import ReactMarkdown from "react-markdown";
import type { ReactNode } from "react";

// ============================================================================
// AIMessage Compound Component
// ============================================================================
// Renders AI assistant messages with markdown support.
//
// Simple usage:
//   <Chat.AIMessage.Root>
//     <Chat.AIMessage.Content>{text}</Chat.AIMessage.Content>
//   </Chat.AIMessage.Root>
//
// With bubble styling:
//   <Chat.AIMessage.Bubble>
//     <Chat.AIMessage.Content>{text}</Chat.AIMessage.Content>
//   </Chat.AIMessage.Bubble>
//
// With custom content and commands:
//   <Chat.AIMessage.Root>
//     <Chat.BlockRenderer blocks={blocks} renderStructured={...} />
//     <Chat.CommandButtons.Root>...</Chat.CommandButtons.Root>
//   </Chat.AIMessage.Root>
// ============================================================================

// Root wrapper - consistent container for AI messages
export interface AIMessageRootProps {
  children: ReactNode;
  className?: string;
}

function Root({ children, className }: AIMessageRootProps) {
  return (
    <div
      data-testid="ai-message"
      data-role="assistant"
      className={twMerge("space-y-3", className)}
    >
      {children}
    </div>
  );
}

// Content component - renders markdown
export interface AIMessageContentProps {
  children: ReactNode;
  state?: "active" | "inactive" | "loading";
  className?: string;
}

function Content({ children, state = "active", className }: AIMessageContentProps) {
  return (
    <div
      data-role="assistant"
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
export const AIMessage = {
  Root,
  Content,
  Bubble,
};
