import type { ButtonHTMLAttributes, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { useChatContext } from "../ChatContext";

export interface SubmitButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick"> {
  /**
   * Custom click handler. If not provided, uses sendMessage from context.
   */
  onClick?: () => void;
  /**
   * Button children. If not provided, renders nothing (expected to pass icon as child).
   */
  children?: ReactNode;
}

/**
 * Chat.Input.SubmitButton - Context-aware submit button.
 *
 * Automatically disables when:
 * - Composer is not ready (no text and no completed attachments)
 * - Chat is streaming
 *
 * @example
 * ```tsx
 * <Chat.Root chat={chat}>
 *   <Chat.Input.SubmitButton>
 *     <ArrowUpIcon className="w-4 h-4" />
 *   </Chat.Input.SubmitButton>
 * </Chat.Root>
 * ```
 */
export function SubmitButton({
  onClick,
  disabled,
  className,
  children,
  ...props
}: SubmitButtonProps) {
  const { composer, isStreaming, sendMessage } = useChatContext();

  const canSubmit = composer.isReady && !isStreaming;

  const handleClick = () => {
    if (!canSubmit) return;

    if (onClick) {
      onClick();
    } else {
      sendMessage();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled ?? !canSubmit}
      className={twMerge(
        "flex items-center justify-center",
        "transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      data-testid="send-button"
      {...props}
    >
      {children}
    </button>
  );
}
