import { CardContent, CardFooter } from "@components/ui/card";
import { Chat, useChatContext } from "@components/shared/chat/Chat";
import WebsiteChatInput from "./chat/WebsiteChatInput";
import type { AnyMessageWithBlocks } from "langgraph-ai-sdk-types";

export interface WebsiteChatViewProps {
  messages?: AnyMessageWithBlocks[];
  isStreaming?: boolean;
}

/**
 * Extracts text content from message blocks for display.
 * Messages from langgraph have a blocks array with typed content.
 */
function getTextFromBlocks(blocks: AnyMessageWithBlocks["blocks"]): string {
  return blocks
    .filter((b) => b.type === "text" && "text" in b)
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");
}

export function WebsiteChatView({ messages = [], isStreaming = false }: WebsiteChatViewProps) {
  return (
    <div className="bg-neutral-background rounded-b-2xl flex flex-col">
      <CardContent className="flex-1 overflow-y-auto px-4 py-4 max-h-[300px]">
        {messages.length > 0 && (
          <Chat.Messages.List className="gap-3">
            {messages.map((message, index) => {
              const isLastMessage = index === messages.length - 1;
              const content = getTextFromBlocks(message.blocks);

              // Show thinking indicator for empty AI messages while streaming
              if (message.role === "assistant" && !content && isLastMessage && isStreaming) {
                return <Chat.ThinkingIndicator key={message.id} text="Thinking" />;
              }

              return (
                <div key={message.id}>
                  {message.role === "assistant" ? (
                    <Chat.AIMessage.Root>
                      <Chat.AIMessage.Content className="text-xs text-base-500 leading-4 prose-sm">
                        {content}
                      </Chat.AIMessage.Content>
                    </Chat.AIMessage.Root>
                  ) : (
                    <Chat.UserMessage className="text-xs leading-4 rounded-lg p-2">
                      {content}
                    </Chat.UserMessage>
                  )}
                </div>
              );
            })}
          </Chat.Messages.List>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-1 px-4 pb-4 pt-0 items-start">
        <WebsiteChatInput />
      </CardFooter>
    </div>
  );
}

export default function WebsiteChat() {
  // Use chat context provided by Chat.Root in Website.tsx
  const { messages, isStreaming } = useChatContext();

  return <WebsiteChatView messages={messages} isStreaming={isStreaming} />;
}
