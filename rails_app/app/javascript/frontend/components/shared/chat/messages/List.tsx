import { forwardRef, type ReactNode, type HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";

export interface ListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

/**
 * Chat.Messages.List - Container for message list.
 *
 * A simple wrapper that provides proper styling and accessibility attributes
 * for a list of chat messages. Does not use context - just a styled container.
 *
 * @example
 * ```tsx
 * <Chat.Messages.List className="space-y-4 max-w-3xl mx-auto">
 *   {messages.map(message => <Message key={message.id} {...message} />)}
 *   <Chat.Messages.StreamingIndicator />
 *   <Chat.Messages.ScrollAnchor />
 * </Chat.Messages.List>
 * ```
 */
export const List = forwardRef<HTMLDivElement, ListProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="log"
        data-testid="message-list"
        className={twMerge(
          "flex flex-col overflow-y-auto",
          // Default spacing between messages, tighter for consecutive AI messages
          "[&>*+*]:mt-4 [&>[data-role=assistant]+[data-role=assistant]]:mt-2",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

List.displayName = "Chat.Messages.List";
