import { Chat } from '@components/chat/Chat.client';
import { Header } from '@components/header/Header';
import React, { useEffect } from 'react';
import { pageStore } from '@stores/page';

interface Project {
    projectName: string;
    threadId: string;
}
interface HomepageProps {
    jwt: string;
    rootPath: string;
    projects: Project[];
}

export default function Home(props: HomepageProps) {
    const { jwt, root_path: rootPath, projects } = props;

    useEffect(() => {
        pageStore.set({ jwt, rootPath });
    }, [jwt, rootPath]);

    return (
        <div className="flex flex-col h-full w-full">
            <Header />
            <Chat />
        </div>
    );
}