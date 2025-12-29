import { useEffect, useRef, useState, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { router } from "@inertiajs/react";
import {
  useLanggraphMessages,
  useLanggraphActions,
  useLanggraphStatus,
  useLanggraphState,
  useLanggraphIsLoading,
} from "langgraph-ai-sdk-react";
import type { BrainstormBridgeType } from "@shared";
import { useBrainstormConfig } from "@hooks/useBrainstormConfig";
import { Chat } from "@components/chat";
import { BrainstormMessage } from "@components/brainstorm/BrainstormMessage";

/**
 * Brainstorm page using new langgraph-ai-sdk patterns and shared Chat components.
 *
 * Two-page flow:
 * - /projects/new: Landing page with empty conversation
 * - /projects/{uuid}/brainstorm: Conversation page with messages
 *
 * On first message submission, the URL is silently replaced using
 * a client-generated UUID (no page reload).
 */
export default function BrainstormNew() {
  const config = useBrainstormConfig();
  const [localThreadId, setLocalThreadId] = useState<string | undefined>(config.initialThreadId);

  const hookOptions = {
    api: config.api,
    headers: config.headers,
    getInitialThreadId: () => localThreadId,
  };

  const messages = useLanggraphMessages<BrainstormBridgeType>(hookOptions);
  const status = useLanggraphStatus<BrainstormBridgeType>(hookOptions);
  const { sendMessage } = useLanggraphActions<BrainstormBridgeType>(hookOptions);
  const isLoadingHistory = useLanggraphIsLoading<BrainstormBridgeType>(hookOptions);
  const currentTopic = useLanggraphState<BrainstormBridgeType, "currentTopic">(
    hookOptions,
    "currentTopic"
  );
  const redirect = useLanggraphState<BrainstormBridgeType, "redirect">(hookOptions, "redirect");

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track if we've already updated the URL
  const hasUpdatedUrl = useRef(config.initialThreadId ? true : false);

  // Handle redirect when brainstorm is complete
  useEffect(() => {
    if (redirect === "website_builder" && localThreadId) {
      router.visit(`/projects/${localThreadId}/website`);
    }
  }, [redirect, localThreadId]);

  // Handle clicking on example suggestions
  const handleExampleClick = useCallback((text: string) => {
    setInput(text);
    textareaRef.current?.focus();
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle message submission
  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;

    // On first message, generate UUID and update URL silently
    if (config.isNewConversation && !hasUpdatedUrl.current) {
      const newUuid = uuidv4();
      setLocalThreadId(newUuid);
      hasUpdatedUrl.current = true;

      // Update URL without reload
      const newUrl = `/projects/${newUuid}/brainstorm`;
      window.history.replaceState({}, "", newUrl);
    }

    sendMessage(input.trim());
    setInput("");
  }, [input, config.isNewConversation, sendMessage]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Loading state
  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-neutral-500">Loading conversation...</div>
      </div>
    );
  }

  const isStreaming = status === "streaming" || status === "submitted";

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto">
      {/* Topic indicator */}
      {currentTopic && (
        <div className="p-4 border-b">
          <Chat.TopicBadge topic={currentTopic} variant="active" />
        </div>
      )}

      {/* Messages */}
      <Chat.MessageList.Root className="flex-1 p-4">
        {messages.length === 0 && (
          <div className="text-center text-neutral-500 py-12">
            <h1 className="text-2xl font-semibold mb-2">Let's brainstorm your business idea</h1>
            <p className="text-sm">
              Tell me about your business, and I'll help you create compelling marketing copy.
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const isLastMessage = index === messages.length - 1;

          if (isUser) {
            return (
              <Chat.UserMessage key={message.id}>
                {message.blocks
                  .filter((b) => b.type === "text")
                  .map((b) => ("text" in b ? b.text : ""))
                  .join("")}
              </Chat.UserMessage>
            );
          }

          // AI message - check if it has content
          const hasContent = message.blocks.some(
            (b) =>
              (b.type === "text" && "text" in b && b.text && b.text.trim()) ||
              b.type === "structured"
          );

          if (!hasContent && isLastMessage && isStreaming) {
            return <Chat.ThinkingIndicator key={message.id} text="Thinking" />;
          }

          return (
            <BrainstormMessage
              key={message.id}
              blocks={message.blocks}
              isActive={isLastMessage}
              onExampleClick={handleExampleClick}
            />
          );
        })}

        {/* Command buttons - show after streaming ends on last AI message */}
        {!isStreaming &&
          messages.length > 0 &&
          messages[messages.length - 1]?.role === "assistant" && (
            <Chat.CommandButtons.Root className="mt-4">
              <Chat.CommandButtons.Button
                variant="primary"
                onClick={() => {
                  if (localThreadId) {
                    router.visit(`/projects/${localThreadId}/website`);
                  }
                }}
              >
                Show Landing Page
              </Chat.CommandButtons.Button>
              <Chat.CommandButtons.Button
                onClick={() => {
                  setInput("Let's continue refining this idea...");
                  textareaRef.current?.focus();
                }}
              >
                Continue Brainstorming
              </Chat.CommandButtons.Button>
            </Chat.CommandButtons.Root>
          )}
        <div ref={messagesEndRef} />
      </Chat.MessageList.Root>

      {/* Input */}
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
    </div>
  );
}
