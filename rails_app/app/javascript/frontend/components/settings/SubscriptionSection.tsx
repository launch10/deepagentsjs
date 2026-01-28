import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { ArrowPathIcon, CheckIcon } from "@heroicons/react/24/outline";
import { CancelSubscriptionModal } from "./CancelSubscriptionModal";

interface SubscriptionSectionProps {
  subscription: {
    id: number;
    status: string;
    plan_name: string;
    plan_display_name: string;
    interval: string;
    amount_cents: number;
    currency: string;
    current_period_start?: string | null;
    current_period_end?: string | null;
    features: string[];
  } | null;
}

export function SubscriptionSection({ subscription }: SubscriptionSectionProps) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

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
          </div>
        </CardHeader>
        <CardContent className="space-y-5 w-full lg:max-w-[704px]">
          {/* Plan Info */}
          <div className="space-y-1">
            <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#96989B]">Current Plan</p>
            <p className="font-['Plus_Jakarta_Sans'] text-base font-medium text-[#0F1113]">
              {subscription.plan_display_name}
            </p>
          </div>

          {/* Features */}
          {subscription.features.length > 0 && (
            <div className="space-y-3">
              <p className="font-['Plus_Jakarta_Sans'] text-sm font-medium text-[#0F1113]">
                What&apos;s included
              </p>
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
        currentPeriodEnd={subscription.current_period_end}
      />
    </>
  );
}
