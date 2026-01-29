import { usePage } from "@inertiajs/react";
import { ProfileSection, BillingCreditsSection, SubscriptionSection } from "@components/settings";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";
import type { InertiaProps } from "@shared";

export type SettingsProps =
  InertiaProps.paths["/settings"]["get"]["responses"]["200"]["content"]["application/json"];

// Derived types for sub-components
export type SettingsUser = SettingsProps["user"];
export type SettingsSubscription = NonNullable<SettingsProps["subscription"]>;
export type SettingsBillingHistoryItem = NonNullable<SettingsProps["billing_history"]>[number];
export type SettingsCreditPack = NonNullable<SettingsProps["credit_packs"]>[number];
export type SettingsPaymentMethod = SettingsProps["payment_method"];

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Settings() {
  const { user, subscription, stripe_portal_url, billing_history, credit_packs, payment_method } =
    usePage<SettingsProps>().props;

  const isCancelled = subscription?.ends_at != null;

  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <div className="px-4 py-6 lg:px-12 lg:py-10">
        <h1 className="font-['IBM_Plex_Serif'] text-[28px] font-semibold text-[#2E3238] mb-6">
          Account Settings
        </h1>

        {isCancelled && subscription?.ends_at && (
          <div className="mb-6 flex items-start gap-3 rounded-lg bg-[#FEF3E7] border border-[#F5D5B5] px-4 py-3 w-full lg:w-[911px]">
            <ExclamationCircleIcon className="h-5 w-5 text-[#D97706] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#92400E]">
                Your subscription has been cancelled
              </p>
              <p className="font-['Plus_Jakarta_Sans'] text-sm text-[#B45309]">
                Your plan will end on {formatDate(subscription.ends_at)}. Any remaining credits,
                connected domains, and included benefits will expire at that time.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <ProfileSection user={user} />
          <BillingCreditsSection
            stripePortalUrl={stripe_portal_url}
            billingHistory={billing_history}
            creditPacks={credit_packs}
            expiresAt={subscription?.ends_at}
            subscriptionPrefixId={subscription?.prefix_id}
            paymentMethod={payment_method}
          />
          <SubscriptionSection subscription={subscription ?? null} />
        </div>
      </div>
    </main>
  );
}
