import { useEffect, useRef } from "react";
import { Spinner } from "@components/ui/spinner";
import { useChatMessages, useChatIsLoading } from "@components/chat";
import AIMessage from "./AIMessage";
import HumanMessage from "./HumanMessage";

type Message = {
  role: "assistant" | "user" | "system";
  blocks: { id: string; type: string; text?: string }[];
};

export type AdsChatMessagesViewProps = {
  messages: Message[];
};

export function AdsChatMessagesView({ messages }: AdsChatMessagesViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll container to bottom without affecting parent scroll containers
    const container = containerRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={containerRef} className="space-y-4">
      {messages.map((message, index) => {
        if (message.role === "assistant") {
          // Explicitly filter out tool calls here, we're only looking for text blocks
          return message.blocks
            .filter((block) => block.type === "text")
            .map((block) => (
              <AIMessage
                key={block.id}
                message={block.type === "text" ? block.text : JSON.stringify(block)}
                state={index === messages.length - 1 ? "active" : "inactive"}
              />
            ));
        }
        if (message.role === "user") {
          return message.blocks.map((block) => (
            <HumanMessage
              key={block.id}
              message={block.type === "text" ? block.text : JSON.stringify(block)}
            />
          ));
        }
        return null;
      })}
    </div>
  );
}

/**
 * Container component for ads chat messages.
 * Uses Chat context instead of direct ads hooks for portability.
 */
export default function AdsChatMessages() {
  // Use context hooks (requires Chat.Root ancestor)
  const messages = useChatMessages();

  return <AdsChatMessagesView messages={messages} />;
}
