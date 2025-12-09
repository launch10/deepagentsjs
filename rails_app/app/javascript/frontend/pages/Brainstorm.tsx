import { useEffect, useRef, useState } from "react";
import {
  Wrapper,
  ChatInput,
  Message,
  BrainstormProvider,
  BrainstormHydrator,
} from "@components/brainstorm";
import { useBrainstormChat } from "../hooks/useBrainstormChat";
import {
  useBrainstormStore,
  selectMessages,
  selectStatus,
  selectBrainstorm,
  selectThreadId,
} from "../stores/brainstormStore";

function BrainstormContent() {
  const messages = useBrainstormStore(selectMessages);
  const threadId = useBrainstormStore(selectThreadId);
  const status = useBrainstormStore(selectStatus);
  const state = useBrainstormStore(selectBrainstorm);
  const project = state.project;
  const isLoadingHistory = useBrainstormStore((s) => s.ui.isLoadingHistory);

  const { sendMessage, updateState } = useBrainstormChat();

  useEffect(() => {
    if (threadId && threadId !== null && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.pathname = `/projects/${threadId}/brainstorm`;
      url.search = "";
      window.history.pushState({}, "", url.toString());
    }
  }, [threadId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const [input, setInput] = useState(`Tell me about your business...`);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleExampleClick = (text: string) => {
    setInput(text);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(text.length, text.length);
    }, 0);
  };

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading conversation...</div>
      </div>
    );
  }

  return (
    <BrainstormProvider onExampleClick={handleExampleClick}>
      <Wrapper>
        <div className="mb-4 p-4 bg-gray-800 rounded">
          <div className="text-sm text-gray-400 mb-2">State:</div>
          <pre className="text-xs text-green-400">{JSON.stringify(state, null, 2)}</pre>
        </div>
        {messages.map((message) => (
          <Message key={message.id} message={message} status={status} />
        ))}
        <div ref={messagesEndRef} />
        <ChatInput
          inputRef={inputRef}
          input={input}
          onChange={(e) => setInput(e.target.value)}
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
            setInput("");
          }}
        />
      </Wrapper>
    </BrainstormProvider>
  );
}

export default function Brainstorm() {
  return (
    <BrainstormHydrator>
      <BrainstormContent />
    </BrainstormHydrator>
  );
}
