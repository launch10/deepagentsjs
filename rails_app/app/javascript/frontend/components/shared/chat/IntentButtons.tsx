import { twMerge } from "tailwind-merge";
import type { ReactNode, ButtonHTMLAttributes, HTMLAttributes } from "react";

// Root container
export interface IntentButtonsRootProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

function Root({ children, className, ...props }: IntentButtonsRootProps) {
  return (
    <div
      data-testid="intent-buttons"
      className={twMerge("flex flex-wrap gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// Button component
export type IntentButtonVariant = "primary" | "secondary";

export interface IntentButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: IntentButtonVariant;
  className?: string;
}

const variantStyles: Record<IntentButtonVariant, string> = {
  primary: "bg-primary-500 text-white hover:bg-primary-600",
  secondary: "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
};

function Button({ children, variant = "secondary", className, ...props }: IntentButtonProps) {
  return (
    <button
      type="button"
      className={twMerge(
        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// Export as compound component
export const IntentButtons = {
  Root,
  Button,
};
