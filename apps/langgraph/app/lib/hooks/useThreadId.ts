import { useParams } from "@remix-run/react";

export function useThreadId() {
    const { threadId } = useParams();
    return { threadId };
}

export function redirectToThreadId(threadId: string) {
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/projects/${threadId}`, { replace: true });`
   */
  const url = new URL(window.location.href);
  url.pathname = `/projects/${threadId}`;

  window.history.replaceState({}, '', url);
}