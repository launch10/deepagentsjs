import { router } from '@inertiajs/react'; 
import { pageStore } from '@stores/page';

export function urlThreadId() {
    const path = window.location.href;
    const match = path.match(/\/projects\/([^/]+)/);
    if (match && match[1]) {
        return match[1];
    }
    return undefined;
};

export function redirectToThreadId(threadId: string) {
  const newUrl = `/projects/${threadId}`;
  window.history.replaceState(null, '', newUrl);
  // router.visit(newUrl, {
  //   preserveState: true,
  //   preserveScroll: true,
  // });
}