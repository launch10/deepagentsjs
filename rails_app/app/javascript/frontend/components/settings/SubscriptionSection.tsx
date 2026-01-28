import { useState } from "react";
import { router } from "@inertiajs/react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/24/outline";
import { CancelSubscriptionModal } from "./CancelSubscriptionModal";
import type { SettingsSubscription } from "@pages/Settings";

interface SubscriptionSectionProps {
  subscription: SettingsSubscription | null;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SubscriptionSection({ subscription }: SubscriptionSectionProps) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  const isCancelled = subscription?.ends_at != null;

  const handleReactivate = async () => {
    if (!subscription) return;

    setIsReactivating(true);
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");

      const response = await fetch(`/subscriptions/${subscription.prefix_id}/resume`, {
        method: "POST",
        headers: {
          "X-CSRF-Token": csrfToken || "",
          Accept: "application/json",
        },
        credentials: "same-origin",
      });

      if (response.ok) {
        router.reload();
      } else {
        const text = await response.text();
        alert(text || "Failed to reactivate subscription. Please try again.");
      }
    } catch {
      alert("An error occurred. Please try again.");
    } finally {
      setIsReactivating(false);
    }
  };

  if (!subscription) {
    return (
      <Card className="bg-white border-neutral-300 rounded-2xl w-full lg:w-[911px]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-green-100">
              <ArrowPathIcon className="h-4 w-4 text-accent-green-500" />
            </div>
            <CardTitle className="font-['Plus_Jakarta_Sans'] text-lg font-semibold text-[#2E3238]">
              Subscription
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="font-['Plus_Jakarta_Sans'] text-sm text-[#74767A]">
            No active subscription.
          </p>
          <Button
            asChild
            className="mt-4 bg-[#3748B8] hover:bg-[#2d3a9a] text-white font-['Plus_Jakarta_Sans']"
          >
            <a href="/pricing">View Plans</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-white border-neutral-300 rounded-2xl w-full lg:w-[911px]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-green-100">
                <ArrowPathIcon className="h-4 w-4 text-accent-green-500" />
              </div>
              <CardTitle className="font-['Plus_Jakarta_Sans'] text-lg font-semibold text-[#2E3238]">
                Subscription
              </CardTitle>
            </div>
            {isCancelled ? (
              <Button
                onClick={handleReactivate}
                disabled={isReactivating}
                className="bg-[#2E3238] hover:bg-[#1a1e22] text-white font-['Plus_Jakarta_Sans'] text-sm py-1.5 px-4 h-auto disabled:opacity-50"
              >
                {isReactivating ? "Reactivating..." : "Reactivate Plan"}
              </Button>
            ) : (
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setCancelModalOpen(true)}
                  className="font-['Plus_Jakarta_Sans'] text-sm text-[#D14F34] hover:text-[#D14F34] hover:bg-transparent"
                >
                  Cancel Subscription
                </Button>
                <Button
                  onClick={() => {
                    // TODO: Redirect to Stripe customer portal
                  }}
                  className="bg-[#2E3238] hover:bg-[#1a1e22] text-white font-['Plus_Jakarta_Sans'] text-sm py-1.5 px-4 h-auto"
                >
                  Change Plan
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 w-full lg:max-w-[704px]">
          {/* Plan Info */}
          <div className="space-y-1">
            <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#96989B]">Current Plan</p>
            <div className="flex items-center gap-2">
              <p className="font-['Plus_Jakarta_Sans'] text-base font-medium text-[#0F1113]">
                {subscription.plan_display_name}
              </p>
              {isCancelled && (
                <span className="px-2 py-0.5 rounded-full bg-[#FEF3E7] text-[#D97706] font-['Plus_Jakarta_Sans'] text-xs font-medium">
                  Cancelled
                </span>
              )}
            </div>
          </div>

          {/* Features */}
          {subscription.features.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="font-['Plus_Jakarta_Sans'] text-sm font-medium text-[#0F1113]">
                  What&apos;s included
                </p>
                {isCancelled && subscription.ends_at && (
                  <>
                    <span className="text-[#96989B]">•</span>
                    <p className="font-['Plus_Jakarta_Sans'] text-sm text-[#96989B]">
                      Expires {formatDate(subscription.ends_at)}
                    </p>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {subscription.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-[#2E9E72] flex-shrink-0" />
                    <span className="font-['Plus_Jakarta_Sans'] text-sm text-[#74767A]">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <CancelSubscriptionModal
        open={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        subscriptionPrefixId={subscription.prefix_id}
        currentPeriodEnd={subscription.current_period_end}
      />
    </>
  );
}
