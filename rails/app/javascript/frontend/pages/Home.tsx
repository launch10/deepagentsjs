import { Chat } from '@components/chat/Chat.client';
import { Header } from '@components/header/Header';

interface HomepageProps {
    accountId: number;
    userId: number;
}

export default function Home(props: HomepageProps) {
    return (
        <>
            <div className="flex flex-col h-full w-full">
                <Header />
                <Chat />
            </div>
        </>
    );
}