import { useState, useEffect, useMemo } from "react";
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { cn } from "~/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface PageNameInputProps {
  value: string;
  onChange: (path: string) => void;
  existingDomainId?: number;
  recommendedPath?: string;
  existingPaths?: string[];
}

// ============================================================================
// Validation
// ============================================================================

const PATH_REGEX = /^\/[a-z0-9-]*$/;

function validatePath(value: string): { valid: boolean; error?: string; warning?: string } {
  // Root path is always valid
  if (value === "/") {
    return { valid: true };
  }

  // Must start with /
  if (!value.startsWith("/")) {
    return { valid: false, error: "Path must start with /" };
  }

  // Single-level only (no nested paths)
  const pathPart = value.slice(1);
  if (pathPart.includes("/")) {
    return { valid: false, error: "Only single-level paths allowed (e.g., /landing)" };
  }

  // Check characters
  if (!PATH_REGEX.test(value)) {
    return { valid: false, error: "Only lowercase letters, numbers, and hyphens" };
  }

  // Max length
  if (pathPart.length > 50) {
    return { valid: false, error: "Max 50 characters" };
  }

  return { valid: true };
}

// ============================================================================
// Component
// ============================================================================

export function PageNameInput({
  value,
  onChange,
  existingDomainId,
  recommendedPath,
  existingPaths = [],
}: PageNameInputProps) {
  const [inputValue, setInputValue] = useState(value.replace(/^\//, ""));
  const [isFocused, setIsFocused] = useState(false);

  // Sync external value changes
  useEffect(() => {
    const newValue = value.replace(/^\//, "");
    if (newValue !== inputValue) {
      setInputValue(newValue);
    }
  }, [value]);

  // Validate the path
  const fullPath = `/${inputValue}`;
  const validation = useMemo(() => validatePath(fullPath), [fullPath]);

  // Check if path conflicts with existing paths
  const isConflicting = useMemo(() => {
    if (!existingDomainId || !existingPaths.length) return false;
    return existingPaths.includes(fullPath);
  }, [existingDomainId, existingPaths, fullPath]);

  // Handle input change
  const handleChange = (newValue: string) => {
    // Remove leading slash if user types it
    const sanitized = newValue.replace(/^\/+/, "").toLowerCase();
    setInputValue(sanitized);

    const path = sanitized ? `/${sanitized}` : "/";
    onChange(path);
  };

  // Determine status for styling
  const status = useMemo(() => {
    if (!inputValue && !isFocused) return "idle";
    if (!validation.valid) return "error";
    if (isConflicting) return "conflict";
    return "valid";
  }, [inputValue, isFocused, validation.valid, isConflicting]);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Input with / prefix */}
      <div
        className={cn(
          "flex items-center rounded-md border bg-white transition-colors",
          status === "error" && "border-destructive",
          status === "conflict" && "border-amber-400",
          status === "valid" && inputValue && "border-success-400",
          status === "idle" && "border-neutral-300",
          isFocused && "ring-2 ring-primary-100 border-primary-400"
        )}
      >
        <span className="pl-3 text-sm text-base-400">/</span>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={recommendedPath?.replace(/^\//, "") || "landing"}
          className="flex-1 px-1 py-2 text-sm bg-transparent outline-none"
          data-testid="page-name-input"
        />
      </div>

      {/* Validation/Status Messages */}
      {validation.error && (
        <div
          data-testid="path-validation-error"
          className="flex items-center gap-1 text-xs text-destructive"
        >
          <XCircleIcon className="size-3.5" />
          <span>{validation.error}</span>
        </div>
      )}

      {isConflicting && (
        <div
          data-testid="path-conflict-warning"
          className="flex items-center gap-1 text-xs text-amber-600"
        >
          <ExclamationTriangleIcon className="size-3.5" />
          <span>This path already exists on this domain</span>
        </div>
      )}

      {status === "valid" && inputValue && !isConflicting && (
        <div
          data-testid="path-valid-indicator"
          className="flex items-center gap-1 text-xs text-success-500"
        >
          <CheckCircleIcon className="size-3.5" />
          <span>/{inputValue}</span>
        </div>
      )}

      {/* Show recommended path hint */}
      {recommendedPath && recommendedPath !== "/" && recommendedPath !== fullPath && (
        <button
          type="button"
          onClick={() => handleChange(recommendedPath.replace(/^\//, ""))}
          className="text-xs text-primary-500 hover:text-primary-600 text-left"
        >
          Suggested: {recommendedPath}
        </button>
      )}
    </div>
  );
}
