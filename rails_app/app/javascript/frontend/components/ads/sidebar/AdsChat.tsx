import { CardContent, CardFooter } from "@components/ui/card";
import { useAdsChat } from "@hooks/useAdsChat";
import { Chat } from "@components/chat";
import AdsChatMessages from "./ads-chat/AdsChatMessages";
import AdsChatInput from "./ads-chat/AdsChatInput";

export default function AdsChat() {
  // Get the full chat snapshot to pass to Chat.Root
  const chat = useAdsChat();

  return (
    <Chat.Root chat={chat}>
      <div className="bg-background rounded-b-2xl  flex flex-col">
        <CardContent className="flex-1 overflow-y-auto px-4 py-4 max-h-[300px]">
          <AdsChatMessages />
        </CardContent>
        <CardFooter className="flex-col gap-1 px-4 pb-4 pt-0 items-start">
          <AdsChatInput />
        </CardFooter>
      </div>
    </Chat.Root>
  );
}
