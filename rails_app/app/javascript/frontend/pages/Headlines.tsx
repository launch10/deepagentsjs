import React, { useEffect, useRef, useState } from 'react';
import { type PageProps } from '@inertiajs/core';
import { usePage } from '@inertiajs/react';
import { useLanggraph } from 'langgraph-ai-sdk-react';
import { Wrapper, ChatInput, Message } from '@components/brainstorm';
import { type AdsBridgeType, Ads, type UUIDType } from '@shared';
import ReactMarkdown from 'react-markdown';

type HeadlinesProps = {
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

export default function Headlines(props: HeadlinesProps) {
    const pageProps = usePage<HeadlinesProps>();
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

    const url = (new URL("api/ads/stream", langgraph_path)).toString();
    const { messages, sendMessage, updateState, status, state, threadId, tools, error, events, isLoadingHistory } =
        useLanggraph<AdsBridgeType>({
            api: url,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            getInitialThreadId: () => urlThreadId.current,
        });

    const hasInitializedStage = useRef(false);
    
    useEffect(() => {
        if (hasInitializedStage.current) {
            return;
        }
        if (!props.workflow || typeof props.workflow !== 'object' || !('substep' in props.workflow) || typeof props.workflow.substep !== 'string') {
            return;
        }
        hasInitializedStage.current = true;
        updateState({
            stage: props.workflow.substep as Ads.StageName,
            projectUUID: props.project!.uuid as UUIDType,
        })
    }, [props.workflow]);

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

    return (
        <Wrapper>
        <h1>Headlines</h1>
        <div className="mb-4 p-4 bg-gray-800 rounded">
            <div className="text-sm text-gray-400 mb-2">State:</div>
            <pre className="text-xs text-green-400">{JSON.stringify(state, null, 2)}</pre>
            <div className="text-sm text-gray-400 mb-2">Events:</div>
            <pre className="text-xs text-green-400">{JSON.stringify(events, null, 2)}</pre>
        </div>

        <h1>Messages</h1>
        {
            messages[0] && messages[0].blocks.map((b) => <ReactMarkdown key={b.id}>{b.text}</ReactMarkdown>)
        }
        <br />
        <br />
        <br />
        <h1>Headlines</h1>
        {
            state.headlines?.map((h) => <ReactMarkdown key={h.text}>{h.text}</ReactMarkdown>)
        }
        <br />
        <br />
        <br />
        <h1>Descriptions</h1>
        {
            state.descriptions?.map((d) => <ReactMarkdown key={d.text}>{d.text}</ReactMarkdown>)
        }
        <div ref={messagesEndRef} />
        <ChatInput
            inputRef={inputRef}
            input={input}
            onChange={(e) => setInput(e.target.value)}
            onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
                setInput('');
            }}
        />
        </Wrapper>
    );
}