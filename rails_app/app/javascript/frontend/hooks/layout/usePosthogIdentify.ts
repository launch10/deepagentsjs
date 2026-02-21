import { useLayoutEffect } from "react";
import { usePage } from "@inertiajs/react";
import { analytics } from "@lib/analytics";
import type { SharedPageProps } from "~/layouts/site-layout";

/**
 * Identifies or resets the current user in PostHog analytics.
 */
export function usePosthogIdentify() {
  const props = usePage().props as SharedPageProps;

  useLayoutEffect(() => {
    if (props.current_user) {
      analytics.identify(props.current_user.id, {
        email: props.current_user.email,
        name: props.current_user.name,
      });
    } else {
      analytics.reset();
    }
  }, [props.current_user]);
}
