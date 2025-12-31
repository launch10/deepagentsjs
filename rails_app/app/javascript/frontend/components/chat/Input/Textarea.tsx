import { forwardRef, type TextareaHTMLAttributes } from "react";
import { twMerge } from "tailwind-merge";
import { useChatContext } from "../ChatContext";

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  /**
   * Optional override for the value.
   * If not provided, uses composer.text from context.
   */
  value?: string;
  /**
   * Optional override for onChange.
   * If not provided, uses composer.setText from context.
   */
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

/**
 * Chat.Input.Textarea - Context-aware textarea that binds to composer.
 *
 * Automatically uses composer.text and composer.setText from ChatContext.
 * Disabled when streaming.
 *
 * @example
 * ```tsx
 * <Chat.Root chat={chat}>
 *   <Chat.Input.Textarea placeholder="Type a message..." />
 * </Chat.Root>
 * ```
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, placeholder, value, onChange, onKeyDown, disabled, ...props }, ref) => {
    const { composer, isStreaming, submit } = useChatContext();

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (onChange) {
        onChange(e);
      } else {
        composer.setText(e.target.value);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (composer.isReady && !isStreaming) {
          submit();
        }
      }
      onKeyDown?.(e);
    };

    return (
      <textarea
        ref={ref}
        value={value ?? composer.text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled ?? isStreaming}
        placeholder={placeholder}
        className={twMerge(
          "w-full resize-none border-0 bg-transparent",
          "text-sm placeholder:opacity-50",
          "focus:outline-none focus:ring-0",
          "font-sans",
          className
        )}
        data-testid="chat-input"
        rows={2}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Chat.Input.Textarea";
