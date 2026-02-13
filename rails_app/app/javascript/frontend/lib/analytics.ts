import posthog from "posthog-js";

export function initPostHog() {
  const apiKey = import.meta.env.VITE_POSTHOG_API_KEY;
  if (!apiKey) return;

  if (import.meta.env.PROD || import.meta.env.VITE_POSTHOG_ENABLED === "true") {
    posthog.init(apiKey, {
      api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      session_recording: { maskAllInputs: true, maskTextContent: false },
      persistence: "localStorage",
    });
  }
}

export function identifyUser(user: { id: number; email: string; name: string }) {
  if (!posthog.__loaded) return;
  posthog.identify(String(user.id), { email: user.email, name: user.name });
}

export function resetUser() {
  if (!posthog.__loaded) return;
  posthog.reset();
}

export const analytics = {
  track(event: string, properties?: Record<string, unknown>) {
    if (!posthog.__loaded) return;
    posthog.capture(event, properties);
  },

  trackProject(event: string, projectUUID: string, properties?: Record<string, unknown>) {
    if (!posthog.__loaded) return;
    posthog.capture(event, { project_uuid: projectUUID, ...properties });
  },

  identify(userId: number, properties?: Record<string, unknown>) {
    if (!posthog.__loaded) return;
    posthog.identify(String(userId), properties);
  },

  reset() {
    if (!posthog.__loaded) return;
    posthog.reset();
  },
};
