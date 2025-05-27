import { router } from '@inertiajs/react'; 
import { pageStore } from '@stores/page';

export function redirectToThreadId(threadId: string) {
  const newUrl = `/projects/${threadId}`;
  pageStore.set({
    ...pageStore.get(),
    threadId,
  });
  // console.log(`setting thread id to ${threadId}`)
  // window.history.replaceState(null, '', newUrl);
  router.visit(newUrl, {
    preserveState: true,
    preserveScroll: true,
  });
}