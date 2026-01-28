import { useState } from "react";
import { router } from "@inertiajs/react";

interface UseReactivateSubscriptionOptions {
  subscriptionPrefixId?: string;
}

export function useReactivateSubscription({
  subscriptionPrefixId,
}: UseReactivateSubscriptionOptions) {
  const [isReactivating, setIsReactivating] = useState(false);

  const reactivate = async () => {
    if (!subscriptionPrefixId) return;

    setIsReactivating(true);
    try {
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");

      const response = await fetch(`/subscriptions/${subscriptionPrefixId}/resume`, {
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

  return { reactivate, isReactivating };
}
