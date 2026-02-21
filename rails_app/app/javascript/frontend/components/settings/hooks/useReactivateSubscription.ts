import { useState } from "react";
import { router } from "@inertiajs/react";

interface UseReactivateSubscriptionOptions {
  subscriptionPrefixId?: string;
}

export function useReactivateSubscription({
  subscriptionPrefixId,
}: UseReactivateSubscriptionOptions) {
  const [isReactivating, setIsReactivating] = useState(false);

  const reactivate = () => {
    if (!subscriptionPrefixId) return;

    setIsReactivating(true);
    router.post(
      `/subscriptions/${subscriptionPrefixId}/resume`,
      {},
      {
        onError: (errors) =>
          alert(
            Object.values(errors).flat().join(", ") ||
              "Failed to reactivate subscription. Please try again."
          ),
        onFinish: () => setIsReactivating(false),
      }
    );
  };

  return { reactivate, isReactivating };
}
