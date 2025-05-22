import { router } from '@inertiajs/react'; 
import { usePage } from '@inertiajs/react'

export function useThreadId() {
    const { threadId } = usePage().props;
    return { threadId };
}

export function redirectToThreadId(threadId: string) {
  const newUrl = `/projects/${threadId}`;
  window.history.replaceState(null, '', newUrl);
}