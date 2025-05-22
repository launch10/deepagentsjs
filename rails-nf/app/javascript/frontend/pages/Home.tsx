import { Chat } from '@components/chat/Chat.client';
import { Header } from '@components/header/Header';
import React from 'react';
import { jwtStore } from '@stores/jwt';

interface HomepageProps {
    jwt: string;
}

export default function Home(props: HomepageProps) {
    const { jwt } = props;
    jwtStore.set(jwt);

    return (
        <div className="flex flex-col h-full w-full">
            <Header />
            <Chat />
        </div>
    );
}