import { usePage } from "@inertiajs/react";
import { BrainstormChat } from "@components/brainstorm";

/**
 * Brainstorm page - thin layout component.
 * Key forces remount when navigating between conversations,
 * resetting the SDK's internal state.
 */
export default function Brainstorm() {
  const { thread_id } = usePage<{ thread_id?: string }>().props;
  return <BrainstormChat key={thread_id || "new"} />;
}
