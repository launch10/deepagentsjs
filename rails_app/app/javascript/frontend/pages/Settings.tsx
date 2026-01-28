import { usePage } from "@inertiajs/react";
import { ProfileSection, BillingCreditsSection, SubscriptionSection } from "@components/settings";
import type { InertiaProps } from "@shared";

export type SettingsProps =
  InertiaProps.paths["/settings"]["get"]["responses"]["200"]["content"]["application/json"];

export default function Settings() {
  const { user, subscription, stripe_portal_url, billing_history, credit_packs } =
    usePage<SettingsProps>().props;

  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <div className="px-4 py-6 lg:px-12 lg:py-10">
        <h1 className="font-['IBM_Plex_Serif'] text-[28px] font-semibold text-[#2E3238] mb-6">
          Account Settings
        </h1>

        <div className="space-y-6">
          <ProfileSection user={user} />
          <BillingCreditsSection
            stripePortalUrl={stripe_portal_url}
            billingHistory={billing_history}
            creditPacks={credit_packs}
          />
          <SubscriptionSection subscription={subscription ?? null} />
        </div>
      </div>
    </main>
  );
}
