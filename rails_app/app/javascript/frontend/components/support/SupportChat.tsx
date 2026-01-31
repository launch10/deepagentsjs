import { useState } from "react";
import { Card, CardContent } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Chat } from "@components/shared/chat/Chat";
import { ChatBubbleLeftEllipsisIcon, XMarkIcon } from "@heroicons/react/24/outline";
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
          <div className="flex flex-col h-[400px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Initial greeting when no messages */}
              {messages.length === 0 && !isStreaming && (
                <div className="flex gap-3">
                  <div className="bg-[#F3F4F6] rounded-lg px-4 py-3 max-w-[85%]">
                    <p className="font-['Plus_Jakarta_Sans'] text-sm text-[#2E3238]">
                      Hi! I can help answer questions about Launch10. What
                      would you like to know?
                    </p>
                  </div>
                </div>
              )}
              <Chat.Messages.List />
            </div>
            <div className="border-t border-[#E5E7EB] p-3">
              <Chat.Input.CreditGate>
                <div className="flex gap-2">
                  <Chat.Input.Textarea
                    placeholder="Ask a question..."
                    className="flex-1"
                  />
                  <Chat.Input.SubmitButton />
                </div>
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
    <div>
      {!isOpen && (
        <Button variant="outline" onClick={onToggle}>
          <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
          Chat with AI Assistant
        </Button>
      )}

      {isOpen && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-medium text-[#2E3238]">
              AI Assistant
            </h3>
            <button
              type="button"
              onClick={onToggle}
              className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
          <SupportChatPanel />
        </div>
      )}
    </div>
  );
}
