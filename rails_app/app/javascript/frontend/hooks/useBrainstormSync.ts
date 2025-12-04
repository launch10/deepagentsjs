import { useEffect } from 'react';
import { useLanggraph } from 'langgraph-ai-sdk-react';
import type { BrainstormBridgeType } from '@shared';
import { 
    useBrainstormStore, 
    selectJwt, 
    selectLanggraphPath, 
    selectThreadId 
} from '../stores/brainstormStore';

export function useBrainstormSync() {
    const jwt = useBrainstormStore(selectJwt);
    const langgraphPath = useBrainstormStore(selectLanggraphPath);
    const initialThreadId = useBrainstormStore(selectThreadId);
    
    const updateFromGraph = useBrainstormStore((s) => s.updateFromGraph);
    const setMessages = useBrainstormStore((s) => s.setMessages);
    const setStatus = useBrainstormStore((s) => s.setStatus);
    const setIsLoadingHistory = useBrainstormStore((s) => s.setIsLoadingHistory);

    const url = langgraphPath 
        ? new URL('api/brainstorm/stream', langgraphPath).toString() 
        : '';

    const { 
        messages, 
        sendMessage, 
        updateState,
        status, 
        state, 
        threadId, 
        isLoadingHistory 
    } = useLanggraph<BrainstormBridgeType>({
        api: url,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
        },
        getInitialThreadId: () => initialThreadId || undefined,
    });

    useEffect(() => {
        if (state) {
            updateFromGraph(state);
        }
    }, [state, updateFromGraph]);

    useEffect(() => {
        setMessages(messages);
    }, [messages, setMessages]);

    useEffect(() => {
        setStatus(status);
    }, [status, setStatus]);

    useEffect(() => {
        setIsLoadingHistory(isLoadingHistory);
    }, [isLoadingHistory, setIsLoadingHistory]);

    return {
        sendMessage,
        threadId,
        updateState,
    };
}
