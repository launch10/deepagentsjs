import type { ButtonHTMLAttributes, ReactNode } from "react";
import { twMerge } from "tailwind-merge";
import { useChatComposer, useChatIsStreaming, useChatSubmit, useChatStop } from "../ChatContext";

export interface SubmitButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "onClick"
> {
  /**
   * Custom stop handler. If not provided, uses stop from context.
   * Only called when streaming and stopIcon is provided.
   */
  onStop?: () => void;
  /**
   * Submit icon/content shown when not streaming.
   */
  children?: ReactNode;
  /**
   * Stop icon shown when streaming. When provided, the button becomes a
   * submit/stop toggle - enabled during streaming to allow cancellation.
   * When not provided, button is disabled during streaming (backward compatible).
   */
  stopIcon?: ReactNode;
}

/**
 * Chat.Input.SubmitButton - Context-aware submit/stop button.
 *
 * Basic usage (disables during streaming):
 * ```tsx
 * <Chat.Input.SubmitButton>
 *   <ArrowUpIcon className="w-4 h-4" />
 * </Chat.Input.SubmitButton>
 * ```
 *
 * With stop support (toggles between submit/stop):
 * ```tsx
 * <Chat.Input.SubmitButton stopIcon={<StopIcon className="w-4 h-4" />}>
 *   <ArrowUpIcon className="w-4 h-4" />
 * </Chat.Input.SubmitButton>
 * ```
 */
export function SubmitButton({
  onStop,
  disabled,
  className,
  children,
  stopIcon,
  ...props
}: SubmitButtonProps) {
  const composer = useChatComposer()
  const isStreaming = useChatIsStreaming()
  const submit = useChatSubmit()
  const stop = useChatStop()

  // When stopIcon is provided, button is enabled during streaming for stop action
  const hasStopMode = stopIcon !== undefined;
  const isInStopMode = hasStopMode && isStreaming;

  // Can submit when composer is ready and not streaming
  const canSubmit = composer.isReady && !isStreaming;

  // Button is enabled when: can submit OR in stop mode
  const isEnabled = canSubmit || isInStopMode;

  const handleClick = () => {
    if (isInStopMode) {
      // Stop streaming
      if (onStop) {
        onStop();
      } else {
        stop();
      }
    } else if (canSubmit) {
      // Send message using context's submit (respects Chat.Root onSubmit)
      submit();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled ?? !isEnabled}
      className={twMerge(
        "flex items-center justify-center",
        "transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      data-testid="send-button"
      aria-label={isInStopMode ? "Stop" : "Send message"}
      {...props}
    >
      {isInStopMode ? stopIcon : children}
    </button>
  );
}
