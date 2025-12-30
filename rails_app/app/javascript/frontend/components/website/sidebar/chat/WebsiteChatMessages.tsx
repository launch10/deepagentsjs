import type { WebsiteChatMessage } from "../WebsiteChat";

export interface WebsiteChatMessagesProps {
  messages: WebsiteChatMessage[];
}

export default function WebsiteChatMessages({ messages }: WebsiteChatMessagesProps) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => (
        <div key={message.id}>
          {message.role === "assistant" ? (
            <p className="text-xs text-base-500 leading-4">{message.content}</p>
          ) : (
            <p className="text-xs text-base-500 leading-4 bg-neutral-100 rounded-lg p-2">
              {message.content}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
