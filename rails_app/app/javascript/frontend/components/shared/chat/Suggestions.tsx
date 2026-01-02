import { twMerge } from "tailwind-merge";
import type { ReactNode } from "react";

// ============================================================================
// Suggestions Compound Component
// ============================================================================
// A list of clickable suggestion/example items. Commonly used in AI messages
// to offer pre-filled response options.
//
// Example:
//   <Chat.Suggestions.Root label="Example answers:">
//     <Chat.Suggestions.Item index={0} onClick={() => handleClick(text)}>
//       {text}
//     </Chat.Suggestions.Item>
//   </Chat.Suggestions.Root>
// ============================================================================

export interface SuggestionsRootProps {
  children: ReactNode;
  /** Label shown above suggestions */
  label?: string;
  className?: string;
}

function Root({ children, label = "Suggestions:", className }: SuggestionsRootProps) {
  return (
    <div className={twMerge("space-y-2 mt-3", className)}>
      {label && <div className="text-xs font-medium text-neutral-500">{label}</div>}
      {children}
    </div>
  );
}

export interface SuggestionsItemProps {
  children: ReactNode;
  /** Optional index to show "Example N" label */
  index?: number;
  /** Click handler */
  onClick?: () => void;
  /** Custom label format (defaults to "Example {index + 1}") */
  labelFormat?: (index: number) => string;
  className?: string;
}

function Item({
  children,
  index,
  onClick,
  labelFormat = (i) => `Example ${i + 1}`,
  className,
}: SuggestionsItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={twMerge(
        "w-full text-left p-3 bg-neutral-50 rounded-lg border border-neutral-200",
        "text-sm hover:bg-neutral-100 transition-colors",
        className
      )}
    >
      {index !== undefined && (
        <div className="font-medium text-primary-600 text-xs mb-1">
          {labelFormat(index)}
        </div>
      )}
      <div className="text-neutral-700">{children}</div>
    </button>
  );
}

export const Suggestions = {
  Root,
  Item,
};
