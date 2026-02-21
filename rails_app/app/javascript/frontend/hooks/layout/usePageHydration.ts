import { useLayoutEffect, useRef } from "react";
import { usePage } from "@inertiajs/react";
import { useProjectStore } from "~/stores/projectStore";
import { useSessionStore } from "~/stores/sessionStore";
import { useCreditStore } from "~/stores/creditStore";
import type { SharedPageProps } from "~/layouts/site-layout";

/**
 * Syncs Inertia page props into Zustand stores before paint.
 * This is the SINGLE place where we read from page props and populate stores.
 */
export function usePageHydration() {
  const page = usePage();
  const url = page.url;
  const props = page.props as SharedPageProps;
  const lastUrlRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    // 1. Session data (persists across navigation - no reset)
    useSessionStore.getState().hydrateFromPageProps({
      current_user: props.current_user,
      true_user: props.true_user,
      impersonating: props.impersonating,
      jwt: props.jwt,
      langgraph_path: props.langgraph_path,
      root_path: props.root_path,
    });

    // 2. Credits data (persists across navigation - no reset)
    useCreditStore.getState().hydrateFromPageProps(props.credits ?? null);

    // 3. Project data (resets on URL change, then hydrates fresh)
    if (lastUrlRef.current !== null && lastUrlRef.current !== url) {
      useProjectStore.getState().reset();
    }
    useProjectStore.getState().setFromPageProps({
      project: props.project,
      website: props.website,
      brainstorm: props.brainstorm,
      campaign: props.campaign,
      deploy: props.deploy,
      thread_id: props.thread_id,
    });
    lastUrlRef.current = url;
  }, [url, props]);
}
