import React, { useEffect, useRef, useState } from 'react';
import { type PageProps } from '@inertiajs/core';
import { usePage } from '@inertiajs/react';
import { useLanggraph } from 'langgraph-ai-sdk-react';
import { Wrapper, ChatInput, Message, ThinkingIndicator } from '@components/brainstorm';
import { type BrainstormLanggraphData } from '@shared';

type BrainstormProps = {
    thread_id: string;
    root_path: string;
    langgraph_path: string;
    jwt: string;
} & PageProps;

export function getUrlThreadId() {
    const path = window.location.href;
    const match = path.match(/brainstorms\/(.*)/)
    if (match && match[1]) {
        return match[1];
    }
    return undefined;
};

export default function Brainstorm(props: BrainstormProps) {
    const pageProps = usePage<BrainstormProps>();
    // Access shared props from Inertia
    let { thread_id, jwt, root_path, langgraph_path } = pageProps.props;
    const urlThreadId = useRef(getUrlThreadId());

    useEffect(() => {
        if (!jwt || !root_path || !langgraph_path) {
            return;
        }
        if (typeof jwt !== 'string' || typeof root_path !== 'string' || typeof langgraph_path !== 'string') {
            throw new Error(`Invalid page props: JWT: ${jwt}, Root Path: ${root_path}, Langgraph Path: ${langgraph_path}`);
        }
    }, []); // Only run once on page mount

    const url = (new URL("api/brainstorm/stream", langgraph_path)).toString();
    const { messages, sendMessage, status, state, threadId, tools, error, events, isLoadingHistory } =
        useLanggraph<BrainstormLanggraphData>({
            api: url,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            getInitialThreadId: () => urlThreadId.current,
        });

    useEffect(() => {
        if (urlThreadId.current === threadId) return;

        if (threadId && typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.pathname = `/brainstorms/${threadId}`;
            url.search = ''; // Clear any existing query params if you want
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