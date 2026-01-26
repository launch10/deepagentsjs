import { Link } from "@inertiajs/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { useCreditStore, formatCredits } from "~/stores/creditStore";

/**
 * Modal shown when a user's credits are exhausted.
 * Provides options to upgrade their plan or purchase credit packs.
 *
 * This modal is controlled by the creditStore:
 * - Shows when `showExhaustionModal` is true
 * - Dismisses and records timestamp to prevent re-showing for 1 hour
 */
export function ExhaustionModal() {
  const showModal = useCreditStore((s) => s.showExhaustionModal);
  const balance = useCreditStore((s) => s.balanceMillicredits);
  const dismissModal = useCreditStore((s) => s.dismissModal);

  return (
    <Dialog open={showModal} onOpenChange={(open) => !open && dismissModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">You've run out of credits</DialogTitle>
          <DialogDescription className="text-base pt-2">
            Your current balance is{" "}
            <span className="font-medium text-foreground">
              {formatCredits(balance)} credits
            </span>
            . To continue using AI features, you can upgrade your plan for more monthly
            credits or purchase a credit pack for immediate use.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          <Button asChild variant="default" className="w-full">
            <Link href="/subscriptions">Upgrade Plan</Link>
          </Button>

          <Button asChild variant="outline" className="w-full">
            <Link href="/subscriptions">Purchase Credit Pack</Link>
          </Button>
        </div>

        <DialogFooter className="sm:justify-center">
          <button
            type="button"
            onClick={dismissModal}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Dismiss for now
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
