import { useEffect } from "react";
import { usePage } from "@inertiajs/react";
import { WebContainerManager } from "@lib/webcontainer";
import type { SharedPageProps } from "~/layouts/site-layout";

/**
 * Starts WebContainer warmup early when user is logged in.
 * Runs in background while user browses, so by the time they
 * navigate to the Website page, the container is already running.
 */
export function useWebContainerWarmup() {
  const props = usePage().props as SharedPageProps;

  useEffect(() => {
    if (props.current_user) {
      WebContainerManager.warmup().catch((e) => {
        console.error("[WebContainer] Warmup failed:", e);
      });
    }
  }, [props.current_user]);
}
