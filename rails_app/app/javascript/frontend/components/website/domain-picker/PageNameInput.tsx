import { useState, useEffect, useMemo } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { cn } from "~/lib/utils";
import { useSearchWebsiteUrls } from "~/api/domainContext.hooks";
import { useDebounce } from "~/hooks/useDebounce";
import { Spinner } from "@components/ui/spinner";

// ============================================================================
// Types
// ============================================================================

export interface PageNameInputProps {
  value: string;
  onChange: (path: string) => void;
  /** Callback when user finishes editing (blur) - triggers save */
  onBlur?: () => void;
  domainId?: number;
  websiteId?: number;
  recommendedPath?: string;
  /** Callback when availability status changes */
  onAvailabilityChange?: (status: "checking" | "available" | "unavailable" | "existing" | "assigned" | null) => void;
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
  onBlur,
  domainId,
  websiteId,
  recommendedPath,
  onAvailabilityChange,
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

  // Debounce the path for API calls (300ms delay)
  const debouncedPath = useDebounce(fullPath, 300);

  // Check availability with backend
  const {
    data: searchResult,
    isLoading: isCheckingAvailability,
    isFetching,
  } = useSearchWebsiteUrls(
    domainId,
    validation.valid && debouncedPath ? [debouncedPath] : [],
    { enabled: !!domainId && validation.valid && !!debouncedPath }
  );

  // Get availability status from search result
  const availabilityStatus = useMemo(() => {
    if (!domainId || !validation.valid) return null;
    if (isCheckingAvailability || isFetching || debouncedPath !== fullPath) return "checking";
    if (!searchResult?.results?.[0]) return null;

    const result = searchResult.results[0];

    // If the path is assigned to the current website, show as "assigned"
    if (result.status === "existing" && websiteId && result.existing_website_id === websiteId) {
      return "assigned";
    }

    return result.status as "available" | "unavailable" | "existing";
  }, [domainId, websiteId, validation.valid, isCheckingAvailability, isFetching, debouncedPath, fullPath, searchResult]);

  // Notify parent of availability changes
  useEffect(() => {
    onAvailabilityChange?.(availabilityStatus);
  }, [availabilityStatus, onAvailabilityChange]);

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
    if (availabilityStatus === "checking") return "checking";
    if (availabilityStatus === "unavailable") return "unavailable";
    if (availabilityStatus === "existing") return "existing";
    if (availabilityStatus === "assigned") return "assigned";
    if (availabilityStatus === "available") return "available";
    return "idle";
  }, [inputValue, isFocused, validation.valid, availabilityStatus]);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Input with / prefix */}
      <div
        className={cn(
          "flex items-center rounded-md border bg-white transition-colors",
          status === "error" && "border-destructive",
          status === "unavailable" && "border-destructive",
          status === "existing" && "border-amber-400",
          status === "assigned" && "border-success-400",
          status === "available" && "border-success-400",
          status === "checking" && "border-neutral-300",
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
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          placeholder={recommendedPath?.replace(/^\//, "") || "landing"}
          className="flex-1 px-1 py-2 text-sm bg-transparent border-0 outline-none focus:ring-0"
          data-testid="page-name-input"
        />
        {/* Checking indicator */}
        {status === "checking" && (
          <div className="pr-3" data-testid="path-checking-indicator">
            <Spinner className="size-4 text-base-400" />
          </div>
        )}
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

      {status === "checking" && (
        <div
          data-testid="path-checking-message"
          className="flex items-center gap-1 text-xs text-base-400"
        >
          <span>Checking availability...</span>
        </div>
      )}

      {status === "unavailable" && (
        <div
          data-testid="path-unavailable-indicator"
          className="flex items-center gap-1 text-xs text-destructive"
        >
          <XCircleIcon className="size-3.5" />
          <span>This path is already taken</span>
        </div>
      )}

      {status === "existing" && (
        <div
          data-testid="path-existing-indicator"
          className="flex items-center gap-1 text-xs text-amber-600"
        >
          <ExclamationTriangleIcon className="size-3.5" />
          <span>You already use this path on this domain</span>
        </div>
      )}

      {status === "assigned" && (
        <div
          data-testid="path-assigned-indicator"
          className="flex items-center gap-1 text-xs text-success-500"
        >
          <CheckCircleIcon className="size-3.5" />
          <span>/{inputValue} is assigned to this website</span>
        </div>
      )}

      {status === "available" && (
        <div
          data-testid="path-available-indicator"
          className="flex items-center gap-1 text-xs text-success-500"
        >
          <CheckCircleIcon className="size-3.5" />
          <span>/{inputValue} is available</span>
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
