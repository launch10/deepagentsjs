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
    root_path: string;
}

export default function Home(props: HomepageProps) {
    const { jwt, root_path: rootPath } = props;
    const { pageId, isNewThread, threadId } = useStore(pageStore);
    const urlThreadId = getUrlThreadId() || 'new';

    useEffect(() => {
        pageStore.set({
            ...pageStore.get(),
            jwt,
            rootPath,
        });
    }, [jwt, rootPath]);

    // When threadId changes because user navigates to a project, it should become the pageId (causing a re-render of the Chat)
    // When threadId changes because the user started a NEW chat, pageId should remain stable, in order to preserve the ongoing Chat state
    useEffect(() => {
        // If the urlThreadId matches the threadId, exit to avoid infinite loop
        if (urlThreadId === threadId) {
            console.log(`threads match, exiting early`)
            return;
        }

        // When switching to a new thread...
        if (isNewThread) {
            // If we've already set a stable pageId for new chat, exit to avoid infinite loop
            if (urlThreadId === 'new' && pageId) {
                console.log(`threadId=new, exiting early`)
                return;
            }

            // After useStream gives us a new threadId, grab it from the url, and mark isNewThread as false. Now pageStore.threadId reflects reality
            if (urlThreadId !== 'new') {
                console.log(`useStream started, exiting early`)
                pageStore.set({
                    ...pageStore.get(),
                    threadId: urlThreadId,
                    isNewThread: false,
                });
                return;
            }
        }

        // On initial page load, if urlThreadId is 'new', set a stable pageId for new chat OR
        // On initial page load, if urlThreadId is not 'new', set pageId=threadId
        console.log(`setting pageId`);
        pageStore.set({
            ...pageStore.get(),
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