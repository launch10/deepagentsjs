import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import {
  CreditCardIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { useCreditStore } from "~/stores/creditStore";
import { useCreditPackCheckout } from "~/api/creditPackCheckouts.hooks";
import { BuyCreditsModal } from "./BuyCreditsModal";
import { useReactivateSubscription } from "./hooks/useReactivateSubscription";
import type { SettingsProps } from "@pages/Settings";

interface BillingCreditsSectionProps {
  stripePortalUrl?: SettingsProps["stripe_portal_url"];
  billingHistory?: SettingsProps["billing_history"];
  creditPacks?: SettingsProps["credit_packs"];
  expiresAt?: string | null;
  subscriptionPrefixId?: string;
  paymentMethod?: SettingsProps["payment_method"];
}

// Map payment method brands/types to logo file names
const PAYMENT_METHOD_LOGOS: Record<string, string> = {
  // Card brands
  visa: "/images/card-brands/visa.png",
  mastercard: "/images/card-brands/mastercard.png",
  amex: "/images/card-brands/amex.png",
  "american express": "/images/card-brands/amex.png",
  discover: "/images/card-brands/discover.png",
  diners: "/images/card-brands/diners.png",
  "diners club": "/images/card-brands/diners.png",
  jcb: "/images/card-brands/jcb.png",
  // BNPL providers
  affirm: "/images/card-brands/affirm.png",
  klarna: "/images/card-brands/klarna.png",
  afterpay: "/images/card-brands/afterpay.png",
  afterpay_clearpay: "/images/card-brands/afterpay.png",
};

const ITEMS_PER_PAGE = 3;

export function BillingCreditsSection({
  stripePortalUrl,
  billingHistory,
  creditPacks = [],
  expiresAt,
  subscriptionPrefixId,
  paymentMethod,
}: BillingCreditsSectionProps) {
  const { balance, periodEndsAt } = useCreditStore();
  const [currentPage, setCurrentPage] = useState(0);
  const [buyCreditsModalOpen, setBuyCreditsModalOpen] = useState(false);
  const checkoutMutation = useCreditPackCheckout();
  const { reactivate, isReactivating } = useReactivateSubscription({
    subscriptionPrefixId,
  });

  const isCancelled = !!expiresAt;

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

  const handleCheckout = (packId: number) => {
    checkoutMutation.mutate(packId, {
      onSuccess: ({ client_secret }) => {
        window.location.href = `/credit_packs/${packId}/checkout?client_secret=${client_secret}`;
      },
      onError: (error) => {
        console.error("Checkout error:", error);
        alert(error.message || "Failed to start checkout");
      },
    });
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
          {/* Credits Usage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#0F1113]">
                Credits Used
              </span>
              <span className="font-['Plus_Jakarta_Sans'] text-sm text-[#2E3238]">
                {(balance ?? 0).toLocaleString()}
              </span>
            </div>
            {expiresAt ? (
              <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#96989B]">
                Expires {formatDate(expiresAt)}
              </p>
            ) : periodEndsAt ? (
              <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#96989B]">
                Plan credits reset on {formatDate(periodEndsAt)}
              </p>
            ) : null}
          </div>

          {/* Purchase Credits / Reactivate Button */}
          {isCancelled ? (
            <Button
              onClick={reactivate}
              disabled={isReactivating}
              className="w-full bg-[#3748B8] hover:bg-[#2d3a9a] text-white font-['Plus_Jakarta_Sans'] text-sm py-2 disabled:opacity-50"
            >
              {isReactivating ? "Reactivating..." : "Reactivate Plan"}
            </Button>
          ) : (
            <Button
              onClick={handlePurchaseCredits}
              disabled={creditPacks.length === 0}
              className="w-full bg-[#3748B8] hover:bg-[#2d3a9a] text-white font-['Plus_Jakarta_Sans'] text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Purchase Credits
            </Button>
          )}

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

          {/* Payment Method */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#0F1113]">
                Payment Method
              </span>
              {stripePortalUrl && (
                <button
                  onClick={handleStripePortal}
                  className="flex items-center gap-1 font-['Plus_Jakarta_Sans'] text-sm text-[#2E3238] hover:underline"
                >
                  Update Payment
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            {/*
              Payment method display is commented out for now.
              Stripe Link intercepts card checkouts and stores them as "link" type,
              making it difficult to reliably show card brand/last4. Users can still
              update their payment method via the Stripe portal link above.

              TODO: Re-enable when we have a better solution for displaying payment
              method info consistently across card, Link, and BNPL payment types.
            */}
            {/* paymentMethod?.type ? (
              <div className="flex items-center gap-[3px]">
                {(() => {
                  const logoKey =
                    paymentMethod.type === "card" && paymentMethod.brand
                      ? paymentMethod.brand.toLowerCase()
                      : paymentMethod.type.toLowerCase();
                  const logoUrl = PAYMENT_METHOD_LOGOS[logoKey];
                  const displayName =
                    paymentMethod.type === "card" && paymentMethod.brand
                      ? paymentMethod.brand
                      : paymentMethod.type;

                  return (
                    <div className="h-[25px] w-[52px] rounded border border-[#E2E1E0] overflow-hidden flex items-center justify-center bg-white">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={displayName}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="font-['Plus_Jakarta_Sans'] text-[10px] font-medium text-[#74767A]">
                          {displayName}
                        </span>
                      )}
                    </div>
                  );
                })()}
                <span className="font-['Plus_Jakarta_Sans'] text-xs font-medium text-[#74767A]">
                  {paymentMethod.type === "card" && paymentMethod.last4
                    ? `•••• •••• •••• ${paymentMethod.last4}`
                    : paymentMethod.type === "link" && paymentMethod.email
                      ? paymentMethod.email
                      : paymentMethod.last4
                        ? `ending in ${paymentMethod.last4}`
                        : null}
                </span>
              </div>
            ) : (
              <span className="font-['Plus_Jakarta_Sans'] text-sm text-[#96989B]">
                No payment method on file
              </span>
            ) */}
          </div>
        </CardContent>
      </Card>

      <BuyCreditsModal
        open={buyCreditsModalOpen}
        onOpenChange={setBuyCreditsModalOpen}
        creditPacks={creditPacks}
        onPurchase={handleCheckout}
        isLoading={checkoutMutation.isPending}
      />
    </>
  );
}
