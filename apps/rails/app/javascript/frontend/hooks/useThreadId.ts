import { router } from '@inertiajs/react'; 
import { usePage } from '@inertiajs/react'

export function useThreadId() {
    const { threadId } = usePage().props;
    return { threadId };
}

export function redirectToThreadId(threadId: string) {
  router.visit(
    `/projects/${threadId}`,
    {
      replace: true,
      preserveState: true,
      preserveScroll: true,
    }
  );
}