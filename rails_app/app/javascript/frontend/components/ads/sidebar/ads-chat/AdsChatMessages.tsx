import { useEffect, useRef } from "react";
import { Spinner } from "@components/ui/spinner";
import { useAdsChatMessages, useAdsChatIsLoadingHistory } from "@hooks/useAdsChat";
import AIMessage from "./AIMessage";
import HumanMessage from "./HumanMessage";

type Message = {
  role: "assistant" | "user";
  blocks: { id: string; type: string; text?: string }[];
};

export type AdsChatMessagesViewProps = {
  messages: Message[];
  isLoading?: boolean;
};

export function AdsChatMessagesView({ messages, isLoading = false }: AdsChatMessagesViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll container to bottom without affecting parent scroll containers
    const container = containerRef.current?.parentElement;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  if (isLoading) {
    return <Spinner />;
  }

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

export default function AdsChatMessages() {
  const messages = useAdsChatMessages();
  const isLoadingHistory = useAdsChatIsLoadingHistory();

  return <AdsChatMessagesView messages={messages} isLoading={isLoadingHistory} />;
}
