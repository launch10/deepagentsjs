import { useBrainstormChatState } from "@hooks/useBrainstormChat";
import { Chat } from "@components/chat";

/**
 * Displays the current brainstorm topic badge.
 * Fetches topic state directly via hook.
 */
export function BrainstormTopic() {
  const currentTopic = useBrainstormChatState("currentTopic");

  if (!currentTopic) return null;

  return (
    <div className="p-4 border-b">
      <Chat.TopicBadge topic={currentTopic} variant="active" />
    </div>
  );
}
