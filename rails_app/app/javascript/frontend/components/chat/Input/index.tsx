import { twMerge } from "tailwind-merge";
import {
  forwardRef,
  type ReactNode,
  type TextareaHTMLAttributes,
  type ButtonHTMLAttributes,
} from "react";
import { ArrowUp, FilePlus, Sparkles } from "lucide-react";

// Root container
export interface InputRootProps {
  children: ReactNode;
  className?: string;
}

function Root({ children, className }: InputRootProps) {
  return <div className={twMerge("flex items-end gap-2", className)}>{children}</div>;
}

// Textarea component
export interface InputTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, InputTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={twMerge(
          "flex-1 resize-none rounded-lg border border-neutral-200 bg-white px-4 py-3",
          "text-sm placeholder:text-neutral-400",
          "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent",
          "min-h-[44px] max-h-[200px]",
          className
        )}
        rows={1}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Input.Textarea";

// Submit button
export interface InputSubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  className?: string;
}

function SubmitButton({ loading, disabled, className, onClick, ...props }: InputSubmitButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={twMerge(
        "flex items-center justify-center",
        "w-10 h-10 rounded-lg",
        "bg-primary-500 text-white",
        "hover:bg-primary-600 transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <ArrowUp className="w-5 h-5" />
      )}
    </button>
  );
}

// File upload button (for Campaign)
export interface InputFileUploadProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

function FileUpload({ className, ...props }: InputFileUploadProps) {
  return (
    <button
      type="button"
      className={twMerge(
        "flex items-center justify-center",
        "w-10 h-10 rounded-lg",
        "border border-neutral-200 bg-white text-neutral-600",
        "hover:bg-neutral-50 transition-colors",
        className
      )}
      {...props}
    >
      <FilePlus className="w-5 h-5" />
    </button>
  );
}

// Refresh button (for Campaign)
export interface InputRefreshButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
}

function RefreshButton({ className, ...props }: InputRefreshButtonProps) {
  return (
    <button
      type="button"
      className={twMerge(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        "border border-neutral-200 bg-white text-neutral-600 text-sm",
        "hover:bg-neutral-50 transition-colors",
        className
      )}
      {...props}
    >
      <Sparkles className="w-4 h-4" />
      <span>Refresh</span>
    </button>
  );
}

// Export as compound component
export const Input = {
  Root,
  Textarea,
  SubmitButton,
  FileUpload,
  RefreshButton,
};
