import { CardContent, CardFooter } from "@components/ui/card";
import WebsiteChatMessages from "./chat/WebsiteChatMessages";
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
        <WebsiteChatMessages messages={messages} />
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
    console.log("Message sent:", message);
  };

  return <WebsiteChatView messages={defaultMessages} onSendMessage={handleSendMessage} />;
}
