import { Chat } from '@components/chat/Chat.client';
import { Header } from '@components/header/Header';
import React, { useEffect } from 'react';
import { pageStore } from '@stores/page';
import type { PageState } from '@stores/page';
import { usePage } from '@inertiajs/react';
import { urlThreadId as getUrlThreadId } from '@hooks/useThreadId';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@nanostores/react';
import { LanggraphProvider } from '@context/LanggraphContext';

interface HomepageProps {
    jwt: string;
    rootPath: string;
    // threadId from props is not directly used for initialization logic here
}

export default function Home(props: HomepageProps) {
    const { jwt, rootPath } = props;
    const { pageId, isNewThread, threadId } = useStore(pageStore);
    const urlThreadId = getUrlThreadId() || 'new';

    useEffect(() => {
        pageStore.set({
            jwt,
            rootPath,
        });
    }, [jwt, rootPath]);

    useEffect(() => {
        if (urlThreadId === 'new' && pageId) {
            console.log('defaulting pageId', pageId);
            return;
        }
        if (isNewThread && urlThreadId !== 'new') {
            pageStore.set({
                threadId: urlThreadId,
                isNewThread: false,
            });
            return;
        }
        if (urlThreadId === threadId) {
            return;
        }
        pageStore.set({
            pageId: urlThreadId === 'new' ? uuidv4() : urlThreadId,
            threadId: urlThreadId === 'new' ? null : urlThreadId,
            isNewThread: urlThreadId === 'new',
        })
    }, [urlThreadId, pageId, isNewThread]);

    return (
        <div className="flex flex-col h-full w-full">
            <LanggraphProvider key={pageId}>
                <Header />
                <Chat key={threadId} />
            </LanggraphProvider>
        </div>
    );
}