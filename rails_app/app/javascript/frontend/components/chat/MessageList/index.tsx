import { twMerge } from "tailwind-merge";
import { forwardRef, type ReactNode, type HTMLAttributes } from "react";

// Root container for message list
export interface MessageListRootProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

const Root = forwardRef<HTMLDivElement, MessageListRootProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge("flex flex-col gap-4 overflow-y-auto", className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Root.displayName = "MessageList.Root";

// Export as compound component
export const MessageList = {
  Root,
};
