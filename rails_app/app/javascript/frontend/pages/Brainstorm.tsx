import React, { useEffect, useRef, useState } from 'react';
import { pageStore } from '@stores/page';
import { usePage } from '@inertiajs/react';
import { urlThreadId as getUrlThreadId } from '@hooks/useThreadId';
import { useLanggraph } from 'langgraph-ai-sdk-react';
import { Wrapper, ChatInput, Message, ThinkingIndicator } from '@components/brainstorm';
import { type BrainstormLanggraphData } from '@shared';

interface BrainstormProps {
    thread_id?: string;
}

export default function Brainstorm(props: BrainstormProps) {
    const page = usePage();
    // Access shared props from Inertia
    const { jwt, account_id, root_path: rootPath } = page.props;
    const urlThreadId = getUrlThreadId();

    useEffect(() => {
        if (!jwt || !account_id || !rootPath) {
            return;
        }
        if (typeof jwt !== 'string' || typeof account_id !== 'number' || typeof rootPath !== 'string') {
            throw new Error(`Invalid page props: JWT: ${jwt}, Account ID: ${account_id}, Root Path: ${rootPath}`);
        }
        pageStore.set({
            ...pageStore.get(),
            jwt,
            accountId: account_id,
            rootPath,
        });
    }, []); // Only run once on page mount

    const { messages, sendMessage, status, state, threadId, tools, error, events, isLoadingHistory } =
        useLanggraph<BrainstormLanggraphData>({
            api: "/api/brainstorm",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            getInitialThreadId: () => urlThreadId,
        });

    useEffect(() => {
        if (!urlThreadId || (urlThreadId === threadId)) return;

        pageStore.set({
            ...pageStore.get(),
            threadId: urlThreadId,
        })

        if (threadId && typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('threadId', threadId);
            window.history.pushState({}, '', url.toString());
        }
    }, [threadId, urlThreadId]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const [input, setInput] = useState(`Tell me about your business...`);
    const inputRef = useRef<HTMLInputElement>(null);

    if (isLoadingHistory) {
        return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-gray-500">Loading conversation...</div>
        </div>
        );
    }

    const lastMessage = messages.at(-1);
    const isThinking = lastMessage?.state === 'thinking';
    const visibleMessages = messages.filter(msg => msg.state !== 'thinking');

    return (
        <Wrapper>
            <div className="mb-4 p-4 bg-gray-800 rounded">
                <div className="text-sm text-gray-400 mb-2">State:</div>
                <pre className="text-xs text-green-400">{JSON.stringify(state, null, 2)}</pre>
                <div className="text-sm text-gray-400 mb-2">Events:</div>
                <pre className="text-xs text-green-400">{JSON.stringify(events, null, 2)}</pre>
            </div>
            {visibleMessages.map((message) => (
                <Message
                key={message.id}
                message={message}
                onExampleClick={(text) => {
                    setInput(text);
                    setTimeout(() => inputRef.current?.focus(), 0);
                }}
                />
            ))}
            {isThinking && (
                <ThinkingIndicator tools={tools} />
            )}
            <div ref={messagesEndRef} />
            <ChatInput
                inputRef={inputRef}
                input={input}
                onChange={(e) => setInput(e.target.value)}
                onSubmit={(e) => {
                e.preventDefault();
                sendMessage({ text: input });
                setInput('');
                }}
            />
        </Wrapper>
    );
}