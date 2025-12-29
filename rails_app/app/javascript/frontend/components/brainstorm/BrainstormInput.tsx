import { useBrainstormChatActions, useBrainstormChatStatus } from "@hooks/useBrainstormChat";
import { useBrainstormInput } from "./BrainstormInputContext";
import { FilePlus, ArrowUp } from "lucide-react";

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
    <div className="px-4 pb-4">
      <div
        style={{ maxWidth: "808px", minHeight: "120px" }}
        className="bg-white border border-neutral-300 rounded-xl shadow-[0px_0px_8px_4px_rgba(167,165,161,0.08)] p-4 mx-auto flex flex-col"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='e.g. "FreshFund is a budgeting tool that helps freelancers track income and expenses."'
          disabled={isStreaming}
          className="w-full resize-none border-0 bg-transparent text-sm placeholder:opacity-50 focus:outline-none flex-1 font-sans"
          style={{ color: "#74767a" }}
          rows={2}
        />
        <div className="flex items-center justify-between mt-auto pt-2">
          <button type="button" className="p-0 text-base-500 hover:opacity-70 transition-opacity">
            <FilePlus className="w-6 h-6" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || isStreaming}
            className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary-500 text-white hover:bg-secondary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>
      {/* Help links */}
      <div className="flex items-center justify-center gap-2 mt-4 text-sm text-base-400 font-sans">
        <button className="hover:underline">See examples of answers</button>
        <span className="opacity-70">•</span>
        <button className="hover:underline">Learn how it works</button>
      </div>
    </div>
  );
}
