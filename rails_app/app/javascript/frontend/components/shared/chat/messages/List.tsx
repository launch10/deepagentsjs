import { forwardRef, useRef, useCallback, type ReactNode, type HTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";
import { ScrollContainerProvider } from "./ScrollContainerContext";

export interface ListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

/**
 * Chat.Messages.List - Container for message list.
 *
 * A simple wrapper that provides proper styling and accessibility attributes
 * for a list of chat messages. Provides the scroll container ref to ScrollAnchor
 * via internal context so auto-scroll logic can detect user scroll position.
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
  ({ children, className, ...props }, forwardedRef) => {
    const internalRef = useRef<HTMLDivElement>(null);

    // Merge forwarded ref and internal ref via callback ref
    const mergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        internalRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );

    return (
      <ScrollContainerProvider value={internalRef}>
        <div
          ref={mergedRef}
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
      </ScrollContainerProvider>
    );
  }
);

List.displayName = "Chat.Messages.List";
