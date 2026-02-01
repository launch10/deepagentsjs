import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckIcon } from "@heroicons/react/24/outline";
import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { copyToClipboard } from "@helpers/copyToClipboard";
import { cn } from "~/lib/utils";

// ============================================================================
// Context
// ============================================================================

interface CopyableContextValue {
  text: string;
  copied: boolean;
  copy: () => Promise<void>;
}

const CopyableContext = createContext<CopyableContextValue | null>(null);

function useCopyableContext() {
  const context = useContext(CopyableContext);
  if (!context) {
    throw new Error("Copyable compound components must be used within <Copyable>");
  }
  return context;
}

// ============================================================================
// Root Component
// ============================================================================

interface CopyableProps {
  text: string;
  children: ReactNode;
  className?: string;
  /** Duration in ms to show "copied" state. Default: 2000 */
  feedbackDuration?: number;
}

function CopyableRoot({ text, children, className, feedbackDuration = 2000 }: CopyableProps) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), feedbackDuration);
  }, [text, feedbackDuration]);

  return (
    <CopyableContext.Provider value={{ text, copied, copy }}>
      <div className={cn("inline-flex items-center gap-2", className)}>{children}</div>
    </CopyableContext.Provider>
  );
}

// ============================================================================
// Text Component
// ============================================================================

interface CopyableTextProps {
  className?: string;
}

function CopyableText({ className }: CopyableTextProps) {
  const { text } = useCopyableContext();
  return <span className={className}>{text}</span>;
}

// ============================================================================
// Trigger Component
// ============================================================================

type TriggerRenderProps = { copied: boolean };

interface CopyableTriggerProps {
  children?: ReactNode | ((props: TriggerRenderProps) => ReactNode);
  className?: string;
  /** Show default icon if no children provided */
  showIcon?: boolean;
}

function CopyableTrigger({ children, className, showIcon = true }: CopyableTriggerProps) {
  const { copied, copy } = useCopyableContext();

  const renderChildren = () => {
    if (typeof children === "function") {
      return children({ copied });
    }
    if (children) {
      return children;
    }
    if (showIcon) {
      return copied ? (
        <CheckIcon className="size-4 text-success-500" />
      ) : (
        <DocumentDuplicateIcon className="size-4" />
      );
    }
    return null;
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center justify-center transition-colors",
        "text-base-400 hover:text-base-500",
        copied && "text-success-500",
        className
      )}
    >
      {renderChildren()}
    </button>
  );
}

// ============================================================================
// Feedback Component (optional text feedback)
// ============================================================================

interface CopyableFeedbackProps {
  children?: ReactNode;
  className?: string;
  /** Text to show when not copied */
  idleText?: string;
  /** Text to show when copied */
  copiedText?: string;
}

function CopyableFeedback({
  children,
  className,
  idleText,
  copiedText = "Copied!",
}: CopyableFeedbackProps) {
  const { copied } = useCopyableContext();

  if (children) {
    return <span className={className}>{children}</span>;
  }

  // Only show if we have text to show
  if (!idleText && !copied) return null;

  return (
    <span className={cn("text-sm", copied ? "text-success-500" : "text-base-500", className)}>
      {copied ? copiedText : idleText}
    </span>
  );
}

// ============================================================================
// Export as Compound Component
// ============================================================================

export const Copyable = Object.assign(CopyableRoot, {
  Text: CopyableText,
  Trigger: CopyableTrigger,
  Feedback: CopyableFeedback,
});
