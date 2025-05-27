import { Chat } from '@components/chat/Chat.client';
import { Header } from '@components/header/Header';
import React, { useEffect } from 'react';
import { pageStore } from '@stores/page';
import { usePage } from '@inertiajs/react';
import { urlThreadId as getUrlThreadId } from '@hooks/useThreadId';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@nanostores/react';
interface HomepageProps {
    jwt: string;
    rootPath: string;
    threadId: string;
}

export default function Home(props: HomepageProps) {
    const { jwt, rootPath } = props;
    const { isNewThread, threadId: storeThreadId } = useStore(pageStore);
    const urlThreadId = getUrlThreadId() || 'new';

    useEffect(() => {
        pageStore.set({ jwt, rootPath });
    }, [jwt, rootPath]);

    useEffect(() => {
        console.log("urlThreadId", urlThreadId)
        console.log("isNewThread", isNewThread)
        console.log("storeThreadId", storeThreadId)
        if (isNewThread && storeThreadId) {
            console.log("exit early")
            return;
        } else {
            if (urlThreadId === 'new') {
                console.log("Creating new thread")
                pageStore.set({ threadId: uuidv4(), isNewThread: true });
            } else {
                console.log("Setting thread id to", urlThreadId)
                pageStore.set({ threadId: urlThreadId, isNewThread: false });
            }
        }
    }, [urlThreadId]);

    return (
        <div className="flex flex-col h-full w-full">
            <Header />
            <Chat />
        </div>
    );
}