import { router } from '@inertiajs/react'; 
import { pageStore } from '@stores/page';

export function redirectToThreadId(threadId: string) {
  const newUrl = `/projects/${threadId}`;
  pageStore.set((prev) => ({
    ...prev,
    threadId,
  }));
  console.log(`setting thread id to ${threadId}`)
  window.history.replaceState(null, '', newUrl);
}