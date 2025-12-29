import {
  useBrainstormChatActions,
  useBrainstormChatStatus,
} from "@hooks/useBrainstormChat";
import { Chat } from "@components/chat";
import { useBrainstormInput } from "./BrainstormInputContext";

/**
 * Brainstorm input area.
 * Uses context for input state, hooks for SDK actions.
 */
export function BrainstormInput() {
  const { sendMessage } = useBrainstormChatActions();
  const status = useBrainstormChatStatus();
  const { input, setInput, textareaRef } = useBrainstormInput();

  const isStreaming = status === "streaming" || status === "submitted";

  const handleSubmit = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 border-t bg-white">
      <Chat.Input.Root>
        <Chat.Input.Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell me about your business idea..."
          disabled={isStreaming}
        />
        <Chat.Input.SubmitButton
          onClick={handleSubmit}
          disabled={!input.trim() || isStreaming}
          loading={isStreaming}
        />
      </Chat.Input.Root>
    </div>
  );
}
