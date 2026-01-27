import { usePage } from "@inertiajs/react";
import { ProfileSection, BillingCreditsSection, SubscriptionSection } from "@components/settings";
import type { InertiaProps } from "@shared";

export type SettingsProps =
  InertiaProps.paths["/settings"]["get"]["responses"]["200"]["content"]["application/json"];

export default function Settings() {
  const { user, credit_balance, subscription, stripe_portal_url } = usePage<SettingsProps>().props;

  return (
    <main className="min-h-screen bg-[#FAFAF9]">
      <div className="mx-auto max-w-[911px] px-4 py-8">
        <h1 className="font-['IBM_Plex_Serif'] text-[28px] font-semibold text-[#2E3238] mb-6">
          Account Settings
        </h1>

        <div className="space-y-6">
          <ProfileSection user={user} />
          <BillingCreditsSection
            creditBalance={credit_balance}
            stripePortalUrl={stripe_portal_url}
          />
          <SubscriptionSection subscription={subscription ?? null} />
        </div>
      </div>
    </main>
  );
}
