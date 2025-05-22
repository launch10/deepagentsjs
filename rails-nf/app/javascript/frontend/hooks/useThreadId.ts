import { router } from '@inertiajs/react'; 
import { usePage } from '@inertiajs/react'

export function useThreadId() {
    const {thread_id} = usePage().props;
    return { threadId: thread_id };
}

export function redirectToThreadId(threadId: string) {
  const newUrl = `/projects/${threadId}`;
  window.history.replaceState(null, '', newUrl);
}