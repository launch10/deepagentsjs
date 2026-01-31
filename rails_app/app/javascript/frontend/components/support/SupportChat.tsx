import { Card, CardContent } from "@components/ui/card";
import { Chat } from "@components/shared/chat/Chat";
import { XMarkIcon, ArrowUpIcon, StopIcon } from "@heroicons/react/24/outline";
import {
  useSupportChat,
  useSupportMessages,
  useSupportIsStreaming,
} from "@hooks/useSupportChat";

function SupportChatPanel() {
  const chat = useSupportChat();
  const messages = useSupportMessages();
  const isStreaming = useSupportIsStreaming();

  return (
    <Card>
      <CardContent className="p-0">
        <Chat.Root chat={chat}>
          <div className="flex flex-col h-[400px] bg-white">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Initial greeting when no messages */}
              {messages.length === 0 && !isStreaming && (
                <div className="flex gap-3">
                  <div className="bg-neutral-100 rounded-lg px-4 py-3 max-w-[85%]">
                    <p className="font-sans text-sm text-base-500">
                      Hi! I can help answer questions about Launch10. What
                      would you like to know?
                    </p>
                  </div>
                </div>
              )}
              <Chat.Messages.List />
            </div>
            <div className="border-t border-neutral-200 p-3">
              <Chat.Input.CreditGate>
                <Chat.Input.DropZone className="relative bg-white border border-neutral-300 rounded-xl p-4 flex flex-col min-h-[100px]">
                  <Chat.Input.Textarea
                    placeholder="Ask a question..."
                    className="flex-1 text-base-500 placeholder:text-neutral-500 placeholder:opacity-100"
                  />
                  <div className="flex items-center justify-end mt-auto pt-2">
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

interface SupportChatProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function SupportChat({ isOpen, onToggle }: SupportChatProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-sm font-medium text-base-500">
          AI Assistant
        </h3>
        <button
          type="button"
          onClick={onToggle}
          className="text-neutral-500 hover:text-neutral-600 transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      <SupportChatPanel />
    </div>
  );
}
