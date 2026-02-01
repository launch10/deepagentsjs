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
 */
export function ClaimSubdomainModal({
  isOpen,
  onClose,
  onConfirm,
  domain,
  creditsRemaining,
  isLoading = false,
}: ClaimSubdomainModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Claim subdomain?</DialogTitle>
          <DialogDescription className="pt-2">
            You are about to claim <span className="font-semibold text-base-600">{domain}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-between rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-3">
            <span className="text-sm text-base-500">Launch10 subdomains remaining</span>
            <span className="text-sm font-semibold text-base-600">
              {creditsRemaining === 1 ? "1 remaining" : `${creditsRemaining} remaining`}
            </span>
          </div>
          {creditsRemaining <= 1 && (
            <p className="text-xs text-amber-600 mt-2">
              {creditsRemaining === 1
                ? "This is your last available subdomain on your current plan."
                : "You have no subdomains remaining. Upgrade your plan to claim more."}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading || creditsRemaining === 0}>
            {isLoading ? "Claiming..." : "Claim subdomain"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
