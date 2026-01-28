import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Progress } from "@components/ui/progress";
import {
  CreditCardIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useCreditStore, useUsagePercent } from "~/stores/creditStore";
import { BuyCreditsModal } from "./BuyCreditsModal";

interface BillingHistoryItem {
  id: string;
  amount_cents: number;
  currency: string;
  description: string;
  created_at: string;
  type: string;
}

interface CreditPack {
  id: number;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id?: string | null;
}

interface BillingCreditsSectionProps {
  stripePortalUrl?: string | null;
  billingHistory?: BillingHistoryItem[] | null;
  creditPacks?: CreditPack[];
}

const ITEMS_PER_PAGE = 3;

export function BillingCreditsSection({
  stripePortalUrl,
  billingHistory,
  creditPacks = [],
}: BillingCreditsSectionProps) {
  const { planCredits, planCreditsAllocated, periodEndsAt } = useCreditStore();
  const usagePercentage = useUsagePercent() ?? 0;
  const [currentPage, setCurrentPage] = useState(0);
  const [buyCreditsModalOpen, setBuyCreditsModalOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const creditsUsed = (planCreditsAllocated ?? 0) - (planCredits ?? 0);

  const totalPages = billingHistory ? Math.ceil(billingHistory.length / ITEMS_PER_PAGE) : 0;
  const paginatedHistory = billingHistory?.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  const handleStripePortal = () => {
    if (stripePortalUrl) {
      window.location.href = stripePortalUrl;
    }
  };

  const handlePurchaseCredits = () => {
    setBuyCreditsModalOpen(true);
  };

  const handleCheckout = async (packId: number) => {
    setIsCheckingOut(true);
    try {
      const response = await fetch(`/credit_packs/${packId}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token":
            document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || "",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create checkout session");
      }

      const { client_secret } = await response.json();

      // Redirect to embedded checkout page with the client secret
      window.location.href = `/credit_packs/${packId}/checkout?client_secret=${client_secret}`;
    } catch (error) {
      console.error("Checkout error:", error);
      alert(error instanceof Error ? error.message : "Failed to start checkout");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1));
  };

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      <Card className="bg-white border-neutral-300 rounded-2xl w-full lg:w-[911px]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-green-100">
              <CreditCardIcon className="h-4 w-4 text-accent-green-500" />
            </div>
            <CardTitle className="font-['Plus_Jakarta_Sans'] text-lg font-semibold text-[#2E3238]">
              Billing & Credits
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 w-full lg:max-w-[704px]">
          {/* Credits Used */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#0F1113]">
                Credits Used
              </span>
              <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#2E3238]">
                {Math.max(0, creditsUsed).toLocaleString()}/
                {(planCreditsAllocated ?? 0).toLocaleString()}
              </span>
            </div>
            <Progress value={usagePercentage} className="h-3.5" />
            {periodEndsAt && (
              <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#96989B]">
                Resets on{" "}
                {new Date(periodEndsAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>

          {/* Purchase Credits Button */}
          <Button
            onClick={handlePurchaseCredits}
            disabled={creditPacks.length === 0}
            className="w-full bg-[#3748B8] hover:bg-[#2d3a9a] text-white font-['Plus_Jakarta_Sans'] text-sm py-2"
          >
            Purchase Credits
          </Button>

          {/* Billing History */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#0F1113]">
                Billing History
              </span>
              {stripePortalUrl && (
                <button
                  onClick={handleStripePortal}
                  className="flex items-center gap-1 font-['Plus_Jakarta_Sans'] text-xs text-[#74767A] hover:underline"
                >
                  View All
                  <ArrowTopRightOnSquareIcon className="h-3 w-3" />
                </button>
              )}
            </div>

            {paginatedHistory && paginatedHistory.length > 0 ? (
              <div className="space-y-3">
                {paginatedHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="font-['Plus_Jakarta_Sans'] text-sm text-[#0F1113]">
                        {item.description}
                      </p>
                      <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#96989B]">
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                    <span className="font-['Plus_Jakarta_Sans'] text-sm text-[#0F1113]">
                      {item.type === "refund" ? "-" : ""}
                      {formatCurrency(item.amount_cents, item.currency)}
                    </span>
                  </div>
                ))}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={handlePrevPage}
                      disabled={currentPage === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Previous page"
                    >
                      <ChevronLeftIcon className="h-4 w-4 text-[#74767A]" />
                    </button>
                    <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#74767A]">
                      {currentPage + 1} / {totalPages}
                    </span>
                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Next page"
                    >
                      <ChevronRightIcon className="h-4 w-4 text-[#74767A]" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="font-['Plus_Jakarta_Sans'] text-sm text-[#96989B]">
                No billing history yet.
              </p>
            )}
          </div>

          {/* Update Payment Method Link */}
          <button
            onClick={handleStripePortal}
            className="flex items-center gap-2 font-['Plus_Jakarta_Sans'] text-sm text-[#2E3238] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!stripePortalUrl}
          >
            Update Payment Method
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>

      <BuyCreditsModal
        open={buyCreditsModalOpen}
        onOpenChange={setBuyCreditsModalOpen}
        creditPacks={creditPacks}
        onPurchase={handleCheckout}
        isLoading={isCheckingOut}
      />
    </>
  );
}
