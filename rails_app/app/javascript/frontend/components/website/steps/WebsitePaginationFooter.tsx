import { Button } from "@components/ui/button";
import { twMerge } from "tailwind-merge";

interface WebsitePaginationFooterProps {
  isLoading: boolean;
  onContinue?: () => void;
  onBack?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  showPreview?: boolean;
}

/**
 * Website-specific pagination footer with disabled/muted styling.
 * Shows "Previous Step", "Preview", and "Continue" buttons in a faded state
 * while the website is being generated.
 *
 * Note: This is a standalone component that doesn't use the shared
 * PaginationFooterView because that component has Ads-specific hooks.
 */
export function WebsitePaginationFooter({
  isLoading,
  onContinue,
  onBack,
  continueLabel = "Continue",
  continueDisabled,
  showPreview = true,
}: WebsitePaginationFooterProps) {
  return (
    <div
      className={twMerge(
        "shrink-0 relative z-10",
        "bg-background",
        isLoading && "opacity-50 pointer-events-none"
      )}
    >
      {/* Border line - fades on left, extends to right edge of screen */}
      <div className="grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%]">
        <div />
        <div
          className="h-px bg-neutral-200 -ml-8 -mr-[2.5vw] shadow-[0px_-16px_26px_0px_rgba(15,17,19,0.06)]"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 32px)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 32px)",
          }}
        />
      </div>

      {/* Button content */}
      <div className="grid grid-cols-[1fr_3fr] gap-x-[3%] px-[2.5%] py-4">
        <div />
        <div className="flex items-center justify-between pr-[2.5%]">
          <Button variant="link" disabled={!onBack} onClick={onBack}>
            Previous Step
          </Button>
          <div className="flex gap-3">
            {showPreview && <Button disabled={isLoading}>Preview</Button>}
            <Button disabled={isLoading || continueDisabled} onClick={onContinue}>
              {continueLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
