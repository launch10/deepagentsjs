import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";

interface ClaimSubdomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  domain: string;
  creditsRemaining: number;
  isLoading?: boolean;
}

/**
 * Confirmation modal for claiming a launch10.site subdomain.
 * Shows the domain being claimed and remaining credits.
 * When no credits remain, shows an upgrade prompt instead.
 */
export function ClaimSubdomainModal({
  isOpen,
  onClose,
  onConfirm,
  domain,
  creditsRemaining,
  isLoading = false,
}: ClaimSubdomainModalProps) {
  // Show upgrade prompt when out of credits
  if (creditsRemaining === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-full bg-amber-100">
                <ExclamationTriangleIcon className="size-5 text-amber-600" />
              </div>
              <div>
                <DialogTitle>Subdomain limit reached</DialogTitle>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-base-500 mb-4">
              You've used all the Launch10 subdomains included in your current plan. Upgrade to get
              more subdomains and unlock additional features.
            </p>

            <div className="rounded-lg bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 px-4 py-3">
              <p className="text-sm font-medium text-primary-700">
                Growth plan includes 2 subdomains
              </p>
              <p className="text-xs text-primary-600 mt-0.5">
                Pro plan includes 3 subdomains + priority support
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={onClose}>
              Maybe later
            </Button>
            <Button asChild>
              <a href="/settings">View plans</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]" data-testid="claim-subdomain-modal">
        <DialogHeader>
          <DialogTitle>Claim subdomain?</DialogTitle>
          <DialogDescription className="pt-2">
            You are about to claim <span className="font-semibold text-base-600">{domain}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-between rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3">
            <span className="text-sm text-base-500">Launch10 subdomains remaining</span>
            <span className="text-sm font-semibold text-base-600" data-testid="credits-remaining">
              {creditsRemaining === 1 ? "1 remaining" : `${creditsRemaining} remaining`}
            </span>
          </div>
          {creditsRemaining === 1 && (
            <p className="text-xs text-amber-600 mt-2">
              This is your last available subdomain on your current plan.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading} data-testid="cancel-claim-button">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading} data-testid="confirm-claim-button">
            {isLoading ? "Claiming..." : "Claim subdomain"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
