import { Chat } from '@components/chat/Chat.client';
import { Header } from '@components/header/Header';
import React, { useEffect } from 'react';
import { pageStore } from '@stores/page';
import { usePage } from '@inertiajs/react';
interface Project {
    projectName: string;
    threadId: string;
}
interface HomepageProps {
    jwt: string;
    rootPath: string;
    threadId: string;
}

export default function Home(props: HomepageProps) {
    const { jwt, rootPath } = props;
    const { url } = usePage();

    useEffect(() => {
        pageStore.set({ jwt, rootPath });
    }, [jwt, rootPath]);

    useEffect(() => {
        if (!url.match(/projects\/[a-zA-Z0-9]*/)) {
            return;
        }
        const threadId = url.split('/').pop();
        console.log(`uppadataing da thread ${threadId}`)
        if (threadId) {
            pageStore.set({ threadId });
        }
    }, [url]);

    return (
        <div className="flex flex-col h-full w-full">
            <Header />
            <Chat />
        </div>
    );
}