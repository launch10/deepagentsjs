import { CardContent, CardFooter } from "@components/ui/card";
import { Chat } from "@components/shared/chat/Chat";
import WebsiteChatInput from "./chat/WebsiteChatInput";

export interface WebsiteChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

export interface WebsiteChatViewProps {
  messages?: WebsiteChatMessage[];
  onSendMessage?: (message: string) => void;
}

export function WebsiteChatView({ messages = [], onSendMessage }: WebsiteChatViewProps) {
  return (
    <div className="bg-neutral-background rounded-b-2xl flex flex-col">
      <CardContent className="flex-1 overflow-y-auto px-4 py-4 max-h-[300px]">
        {messages.length > 0 && (
          <Chat.Messages.List className="gap-3">
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "assistant" ? (
                  <Chat.AIMessage.Root>
                    <Chat.AIMessage.Content className="text-xs text-base-500 leading-4 prose-sm">
                      {message.content}
                    </Chat.AIMessage.Content>
                  </Chat.AIMessage.Root>
                ) : (
                  <Chat.UserMessage className="text-xs leading-4 rounded-lg p-2">
                    {message.content}
                  </Chat.UserMessage>
                )}
              </div>
            ))}
          </Chat.Messages.List>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-1 px-4 pb-4 pt-0 items-start">
        <WebsiteChatInput onSubmit={onSendMessage} />
      </CardFooter>
    </div>
  );
}

export default function WebsiteChat() {
  // TODO: Wire up to actual state management
  const defaultMessages: WebsiteChatMessage[] = [
    {
      id: "1",
      role: "assistant",
      content: "Your website is ready! Feel free to ask me for any changes.",
    },
  ];

  const handleSendMessage = (message: string) => {
    // TODO: Wire up to actual state management
  };

  return <WebsiteChatView messages={defaultMessages} onSendMessage={handleSendMessage} />;
}
