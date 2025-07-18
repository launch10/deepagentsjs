import React from 'react';
import { classNames } from '@lib/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import type { BaseMessageLike } from '@langchain/core/messages';
import { useLanggraphContext } from '@context/LanggraphContext';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: BaseMessageLike[]; 
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props: MessagesProps, ref) => {
  const { id, isStreaming = false, messages = [] } = props;
  const { getMessagesMetadata, submit: regenerate } = useLanggraphContext();
  const isDevEnv = (import.meta.env.VITE_ENV === 'development');

  return (
    <div id={id} ref={ref} className={props.className}>
      {messages.length > 0
        ? messages.map((message, index) => {
            let role = message.type;
            let messageContentString = message.content as string;
            const isUserMessage = role === 'human';
            const isFirst = index === 0;
            const isLast = index === messages.length - 1;

            // Get metadata for the current message
            const meta = getMessagesMetadata ? getMessagesMetadata(message) : null;
            const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;

            return (
              <div
                key={index} 
                className={classNames('flex gap-4 p-6 w-full rounded-[calc(0.75rem-1px)]', {
                  'bg-bolt-elements-messages-background': isUserMessage || !isStreaming || (isStreaming && !isLast),
                  'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent':
                    isStreaming && isLast,
                  'mt-4': !isFirst,
                })}
              >
                {isUserMessage && (
                  <div className="flex items-center justify-center w-[34px] h-[34px] overflow-hidden bg-white text-gray-600 rounded-full shrink-0 self-start">
                    <div className="i-ph:user-fill text-xl"></div>
                  </div>
                )}
                <div className="grid grid-col-1 w-full">
                  {isUserMessage ? (
                    <>
                      <UserMessage content={messageContentString} />
                      {isDevEnv && !isStreaming && parentCheckpoint && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              // Re-submit the same user message from its parent checkpoint
                              regenerate(messageContentString, parentCheckpoint);
                            }}
                            className="text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary transition-colors duration-200 flex items-center gap-1"
                          >
                            <div className="i-ph:arrow-clockwise text-base"></div>
                            <span>Regenerate response</span>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <AssistantMessage 
                      content={messageContentString} 
                      showChanges={isLast}
                    />
                  )}
                </div>
              </div>
            );
          })
        : null}
      {isStreaming && (
        <div className="text-center w-full text-bolt-elements-textSecondary i-svg-spinners:3-dots-fade text-4xl mt-4"></div>
      )}
    </div>
  );
});
