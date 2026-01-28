import { useState } from "react";
import { router } from "@inertiajs/react";
import { Dialog, DialogContent } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface CancelSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionPrefixId: string;
  currentPeriodEnd?: string | null;
}

export function CancelSubscriptionModal({
  open,
  onOpenChange,
  subscriptionPrefixId,
  currentPeriodEnd,
}: CancelSubscriptionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "the end of your billing period";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleCancelSubscription = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");

      const response = await fetch(`/subscriptions/${subscriptionPrefixId}/cancel`, {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": csrfToken || "",
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (response.ok || response.redirected) {
        onOpenChange(false);
        router.reload();
      } else {
        const text = await response.text();
        setError(text || "Failed to cancel subscription. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 border border-[#E2E1E0] rounded-lg shadow-[0px_4px_4px_-1px_rgba(12,12,13,0.1),0px_4px_4px_-1px_rgba(12,12,13,0.05)] [&>button]:hidden">
        <div className="relative px-6 py-8">
          {/* Close button */}
          <button onClick={() => onOpenChange(false)} className="absolute right-6 top-8">
            <XMarkIcon className="h-[18px] w-[18px] text-[#0F1113]" />
          </button>

          {/* Title and Description */}
          <div className="flex flex-col gap-[3px]">
            <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-semibold text-[#0F1113]">
              Cancel Your Subscription?
            </h2>
            <p className="font-['Plus_Jakarta_Sans'] text-sm leading-[18px] text-[#74767A] max-w-[482px]">
              All your pages will remain live until {formatDate(currentPeriodEnd)}. After that date
              your Launch10 webpages will be deactivated.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <p className="mt-4 font-['Plus_Jakarta_Sans'] text-sm text-[#D14F34]">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-4 mt-12">
            <Button
              variant="ghost"
              onClick={handleCancelSubscription}
              disabled={isLoading}
              className="h-11 px-3 font-['Plus_Jakarta_Sans'] text-base font-normal text-[#D14F34] hover:text-[#D14F34] hover:bg-transparent disabled:opacity-50"
            >
              {isLoading ? "Cancelling..." : "Confirm Cancellation"}
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="h-11 px-3 min-w-[165px] bg-[#2E3238] hover:bg-[#1a1e22] border border-[#2E3238] rounded-lg font-['Plus_Jakarta_Sans'] text-base font-normal text-white disabled:opacity-50"
            >
              Keep Subscription
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
