import { Card, CardContent } from "@components/ui/card";
import { Chat } from "@components/shared/chat/Chat";
import { ArrowUpIcon, StopIcon, DocumentPlusIcon } from "@heroicons/react/24/outline";
import { useSupportChat, useSupportMessages } from "@hooks/useSupportChat";

export default function SupportChat() {
  const chat = useSupportChat();
  const messages = useSupportMessages();

  return (
    <Card>
      <CardContent className="p-0">
        <Chat.Root chat={chat}>
          <div className="flex flex-col h-[500px] bg-white">
            <div className="flex-1 overflow-y-auto p-4">
              <Chat.Messages.List className="space-y-4">
                {messages.map((message, index) => {
                  const isLastMessage = index === messages.length - 1;

                  if (message.role === "user") {
                    return (
                      <Chat.UserMessage
                        key={message.id}
                        blocks={message.blocks}
                        className="text-sm"
                      />
                    );
                  }

                  if (message.role === "assistant") {
                    const textBlocks = message.blocks.filter(
                      (b) => b.type === "text" && b.text?.trim()
                    );

                    if (!textBlocks.length) return null;

                    return (
                      <Chat.AIMessage.Root key={message.id}>
                        {textBlocks.map((block) => (
                          <Chat.AIMessage.Content
                            key={block.id}
                            state={isLastMessage ? "active" : "inactive"}
                            className="text-sm"
                          >
                            {block.text}
                          </Chat.AIMessage.Content>
                        ))}
                      </Chat.AIMessage.Root>
                    );
                  }

                  return null;
                })}
                <Chat.Messages.StreamingIndicator />
                <Chat.Messages.ScrollAnchor />
              </Chat.Messages.List>
            </div>
            <div className="border-t border-neutral-200 p-3">
              <Chat.Input.CreditGate>
                <Chat.Input.DropZone className="relative bg-white border border-neutral-300 rounded-xl p-4 flex flex-col min-h-[100px]">
                  <Chat.Input.AttachmentList className="flex flex-wrap gap-2 mb-3" />

                  <Chat.Input.Textarea
                    placeholder="Ask a question..."
                    className="flex-1 text-base-500 placeholder:text-neutral-500 placeholder:opacity-100"
                  />
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <Chat.Input.FileButton className="text-base-500 p-1 hover:bg-neutral-100 rounded">
                      <DocumentPlusIcon className="w-5 h-5" strokeWidth={1.5} />
                    </Chat.Input.FileButton>

                    <Chat.Input.SubmitButton
                      stopIcon={<StopIcon className="w-4 h-4" strokeWidth={2} />}
                      className="w-6 h-6 rounded-full bg-secondary-500 text-white hover:bg-secondary-600"
                    >
                      <ArrowUpIcon className="w-4 h-4" strokeWidth={2} />
                    </Chat.Input.SubmitButton>
                  </div>
                </Chat.Input.DropZone>
              </Chat.Input.CreditGate>
            </div>
          </div>
        </Chat.Root>
      </CardContent>
    </Card>
  );
}
