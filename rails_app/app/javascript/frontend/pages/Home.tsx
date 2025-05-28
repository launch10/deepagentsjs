import { Chat } from '@components/chat/Chat.client';
import { Header } from '@components/header/Header';
import React, { useEffect } from 'react';
import { pageStore } from '@stores/page';
import type { PageState } from '@stores/page';
import { usePage } from '@inertiajs/react';
import { urlThreadId as getUrlThreadId } from '@hooks/useThreadId';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '@nanostores/react';

interface HomepageProps {
    jwt: string;
    rootPath: string;
    // threadId from props is not directly used for initialization logic here
}

export default function Home(props: HomepageProps) {
    const { jwt, rootPath } = props;
    // Get the entire reactive state object from the store
    const currentPageState = useStore(pageStore);
    // Destructure after getting the whole state to ensure values are from the same snapshot
    const { isNewThread, threadId: storeThreadId } = currentPageState;

    // Ensure urlThreadId is consistently 'new' or an actual ID string.
    const urlThreadId = getUrlThreadId() || 'new';

    useEffect(() => {
        // Initialize or update jwt and rootPath in the store.
        // This runs when jwt or rootPath props change.
        const currentStoreValues = pageStore.get();
        if (currentStoreValues.jwt !== jwt || currentStoreValues.rootPath !== rootPath) {
            pageStore.set({
                ...currentStoreValues, // Preserve existing threadId and isNewThread
                jwt,
                rootPath,
            });
        }
    }, [jwt, rootPath]);

    useEffect(() => {
        // This effect handles the core logic for setting the threadId based on the URL.
        const currentStoreSnapshot = pageStore.get(); // Get the absolute latest store state for decision making

        console.log(
            "ThreadLogicEffect: urlThreadId:", urlThreadId,
            "currentStore.isNewThread:", currentStoreSnapshot.isNewThread,
            "currentStore.threadId:", currentStoreSnapshot.threadId
        );

        if (urlThreadId === 'new') {
            // Scenario: URL indicates a new thread (e.g., root path).
            if (!currentStoreSnapshot.threadId || !currentStoreSnapshot.isNewThread) {
                // If store doesn't have a threadId yet, or it's not marked as 'new' (e.g., navigated from existing to new),
                // then generate a new one.
                console.log("ThreadLogicEffect: Creating new thread ID");
                const newGeneratedThreadId = uuidv4();
                pageStore.set({
                    ...currentStoreSnapshot, // Preserve jwt and rootPath from the snapshot
                    threadId: newGeneratedThreadId,
                    isNewThread: true,
                });
            } else {
                // Store already has a threadId and it's marked as new.
                // This means we've likely just generated it and AppLayout re-keyed. Do nothing to break loop.
                console.log("ThreadLogicEffect: Already have a new thread ID (url is 'new'):", currentStoreSnapshot.threadId);
            }
        } else {
            // Scenario: URL has a specific threadId.
            if (currentStoreSnapshot.threadId !== urlThreadId || currentStoreSnapshot.isNewThread) {
                // If store's threadId is different from URL, or if it's still marked as 'new' (e.g., navigated from new to existing),
                // then update the store to match the URL.
                console.log("ThreadLogicEffect: Setting to existing thread ID from URL:", urlThreadId);
                pageStore.set({
                    ...currentStoreSnapshot, // Preserve jwt and rootPath
                    threadId: urlThreadId,
                    isNewThread: false,
                });
            }
        }
        // Dependencies: This effect should re-run if the urlThreadId changes, 
        // or if the relevant parts of the store state (threadId, isNewThread) that it depends on change.
        // currentPageState.threadId and currentPageState.isNewThread are used here to react to store changes.
    }, [urlThreadId, currentPageState.threadId, currentPageState.isNewThread]);

    return (
        <div className="flex flex-col h-full w-full">
            <Header />
            <Chat />
        </div>
    );
}