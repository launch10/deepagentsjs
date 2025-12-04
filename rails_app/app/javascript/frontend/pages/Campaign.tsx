import React, { useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { useLanggraph } from 'langgraph-ai-sdk-react';
import { Wrapper, ChatInput } from '@components/brainstorm';
import { type AdsBridgeType, Ads, type UUIDType, type InertiaProps } from '@shared';
import ReactMarkdown from 'react-markdown';

// Every path under campaign actually has the same props, so we can use the same type
type CampaignProps = InertiaProps.paths['/projects/{uuid}/campaigns/content']['get']['responses']['200']['content']['application/json'];

export default function Campaign(props: CampaignProps) {
    const pageProps = usePage<CampaignProps>();
    // Access shared props from Inertia
    let { thread_id, jwt, langgraph_path, campaign, workflow, project } = pageProps.props;
    const campaignExists = Boolean(campaign?.id);

    const url = (new URL("api/ads/stream", langgraph_path)).toString();
    const { 
        state, 
        messages, 
        sendMessage, 
        updateState, 
        isLoadingHistory 
    } =
        useLanggraph<AdsBridgeType>({
            api: url,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwt}`,
            },
            getInitialThreadId: () => thread_id ? thread_id : undefined,
        });

    useEffect(() => {
        if (!workflow || !workflow.substep || !project?.uuid) return;
        if (campaignExists && workflow.substep === 'content') return;
        if (state.hasStartedStep && workflow.substep in state.hasStartedStep && state.hasStartedStep[workflow.substep as Ads.StageName] === true) return;

        updateState({
            stage: workflow.substep as Ads.StageName,
            projectUUID: project.uuid as UUIDType,
        })
    }, [workflow?.substep, state.hasStartedStep]);

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
        {
            messages && (
                <>
                    <h1>Messages</h1>
                    {
                        messages[0] && messages[0].blocks.map((b) => <ReactMarkdown key={b.id}>{b.text}</ReactMarkdown>)
                    }
                </>
            )
        }
        <br />
        <br />
        <br />
        {
            state.headlines && (
                <>
                <h1>Headlines</h1>
                {
                    state.headlines?.map((h) => <ReactMarkdown key={h.text}>{h.text}</ReactMarkdown>)
                }
                </>
            )
        }
        <br />
        <br />
        <br />
        {
            state.descriptions && (
                <>
                <h1>Descriptions</h1>
                {
                    state.descriptions?.map((d) => <ReactMarkdown key={d.text}>{d.text}</ReactMarkdown>)
                }
                </>
            )
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