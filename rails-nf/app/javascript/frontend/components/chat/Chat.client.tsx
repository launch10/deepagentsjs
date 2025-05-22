import { useStore } from '@nanostores/react';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { usePromptEnhancer, useShortcuts, useSnapScroll } from '@hooks/index';
import { chatStore } from '@stores/chat';
import { workbenchStore } from '@stores/workbench';
import { fileModificationsToHTML } from '@utils/diff';
import { cubicEasingFn } from '@utils/easings';
import { createScopedLogger, renderLogger } from '@utils/logger';
import { BaseChat } from './BaseChat';
import { getTemplateData, templateStore } from '@stores/template';
import { useLanggraphContext } from '@context/LanggraphContext';
import { BaseMessage } from '@langchain/core/messages';
import { CodeTaskAction, CodeTaskType, TaskStatus } from '@shared/models/codeTask';
import type { CodeTask } from '@shared/models/codeTask';
import type { FileMap } from '@shared/models/file';
import { v4 as uuidv4 } from 'uuid';
import type { ActionCore } from '@runtime/action-runner';
import { convertFileMapToFileSystemTree } from '@webcontainer/file-system-utils';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const buildAction = (task: CodeTask, messageId: string): ActionCore => {
    return {
        task,
        messageId,
    };
};

const callbacks = {
    onThreadChanged: (messageId: string) => {
      logger.info('onThreadChanged', messageId);
      workbenchStore.showWorkbench.set(true);
    },
    onMessageStart: (messageId: string) => {
      logger.info('onMessageStart', messageId);
      workbenchStore.addArtifact({
        messageId,
        name: typeof messageId === 'string' ? messageId.substr(0, 20) : 'New Artifact',
      });
    },
    onMessageEnd: (messageId: string) => {
      logger.info('onMessageEnd', messageId);
      workbenchStore.runDevServer(messageId);
      workbenchStore.closeArtifact(messageId);
    },
    mountFiles: async (fileMap: FileMap, messageId: string) => {
      if (!fileMap || Object.keys(fileMap).length === 0) {
        logger.info('mountFiles: No files to mount');
        return;
      }
      if (!messageId) {
        logger.error('mountFiles: messageId is undefined');
        return;
      }
      try {
        const fileSystemTree = convertFileMapToFileSystemTree(fileMap);
        logger.info('TestmountFiles: Converted FileMap to FileSystemTree for messageId:', messageId, fileSystemTree);

        const mountTask: CodeTask = {
          id: uuidv4(),
          title: "Loading template",
          type: CodeTaskType.MOUNT_FILES,
          status: TaskStatus.PENDING, 
          action: CodeTaskAction.UPDATE, 
          payload: { files: fileSystemTree }, 
        };

        const action = buildAction(mountTask, messageId);
        await workbenchStore.addAction(action); 
        await workbenchStore.runAction(action);
        logger.info('mountFiles: MOUNT_FILES action dispatched via workbenchStore for messageId:', messageId, action);

        workbenchStore.installDependencies(messageId);
      } catch (error) {
        logger.error('mountFiles: Error processing or dispatching mount task for messageId:', messageId, error);
      }
    },
    onCodeTask: (task: CodeTask, messageId: string) => {
      logger.info('onCodeTask', JSON.stringify(buildAction(task, messageId)));

      workbenchStore.addAction(buildAction(task, messageId));
      workbenchStore.runAction(buildAction(task, messageId));
    },
    onUpdateFile: (task: CodeTask, messageId: string) => {
      logger.info('onWriteOpen', JSON.stringify(buildAction(task, messageId)));

      workbenchStore.addAction(buildAction(task, messageId));
      workbenchStore.runAction(buildAction(task, messageId));
    },
    onDeleteFile: (task: CodeTask, messageId: string) => {
      logger.info('onWriteClose', JSON.stringify(buildAction(task, messageId)));

      workbenchStore.runAction(buildAction(task, messageId));
    },
    onRenameFile: (task: CodeTask, messageId: string) => {
      logger.info('onRenameFile', JSON.stringify(buildAction(task, messageId)));

      workbenchStore.addAction(buildAction(task, messageId));
    },
    onAddDependency: (task: CodeTask, messageId: string) => {
      logger.info('onAddDependency', JSON.stringify(task));

      workbenchStore.addAction(buildAction(task, messageId));
    },
    onRemoveDependency: (task: CodeTask, messageId: string) => {
      logger.info('onRemoveDependency', JSON.stringify(task));

      workbenchStore.addAction(buildAction(task, messageId));
    }
};

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  return (
    <>
      <ChatImpl />
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          /**
           * @todo Handle more types if we need them. This may require extra color themes.
           */
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
    </>
  );
}

interface ChatProps {
  initialMessages: BaseMessage[];
  storeMessageHistory: (messages: BaseMessage[], threadId?: string | undefined) => Promise<void>;
  navigateChat: (threadId: string) => void;
  currentThreadId: string | undefined;
}

export const ChatImpl = () => {
  useShortcuts();

  const { isLoading, messages, codeTasks, submit, stop, currentThreadId } = useLanggraphContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState('');
  const workbenchClosed = workbenchStore.showWorkbench.get() === false;
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const enhancingPrompt = false;
  const promptEnhanced = false;
  const templateData = useStore(templateStore);

  const { showChat, started: chatStarted } = useStore(chatStore);

  const [animationScope, animate] = useAnimate();
  const processedTaskIds = useRef<Set<string>>(new Set());

  // const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  const humanMessages = messages.filter((m) => m.type == 'human');
  const mostRecentHumanMessage = humanMessages[humanMessages.length - 1];
  const isFirstMessage = humanMessages.length == 1;

  // When thread changes, ensure workbench is showing
  useEffect(() => {
    if (!currentThreadId) return;

    callbacks.onThreadChanged(currentThreadId);
  }, [currentThreadId]);

  // When human message is added, add artifact for actions to run against
  useEffect(() => {
    if (!mostRecentHumanMessage) return;

    callbacks.onMessageStart(mostRecentHumanMessage.id as string);

    if (!templateData) {
      getTemplateData()
    }

    console.log('templateData', templateData)
    if (templateData && !templateLoaded) {
        callbacks.mountFiles(templateData, mostRecentHumanMessage.id as string);
        setTemplateLoaded(true);
    }

    if (!isLoading && mostRecentHumanMessage && templateLoaded) {
      callbacks.onMessageEnd(mostRecentHumanMessage.id as string);
    }
  }, [mostRecentHumanMessage, templateLoaded, templateData]);

  useEffect(() => {
    chatStore.setKey('started', messages.length > 0);
  }, [messages]);

  useEffect(() => {
    if (codeTasks?.completedTasks && codeTasks.completedTasks.length > 0) {
      codeTasks.completedTasks.forEach((task: CodeTask) => {
        if (!task.id || processedTaskIds.current.has(task.id)) {
          return;
        }

        switch (task.action) {
            case CodeTaskAction.UPDATE:
                callbacks.onUpdateFile(task, mostRecentHumanMessage.id as string);
                break;
            case CodeTaskAction.DELETE:
                callbacks.onDeleteFile(task, mostRecentHumanMessage.id as string);
                break;
            default:
                console.warn('Completed code task is missing type or path:', task);
                break;
        }
      });
    }
  }, [codeTasks?.completedTasks]);

  const abort = useCallback(() => {
    if (stop) stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();
  }, [stop]);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  }, [inputValue, textareaRef, TEXTAREA_MAX_HEIGHT]);

  const runAnimation = useCallback(async () => {
    if (chatStarted) {
      return;
    }

    await Promise.all([
      animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);

    chatStore.setKey('started', true);
  }, []);

  const sendMessage = async (_event: React.UIEvent, messageInputText?: string) => {
    const currentInput = messageInputText || inputValue;

    if (currentInput.trim().length === 0 || isLoading) {
      return;
    }

    await workbenchStore.saveAllFiles();
    const fileModifications = workbenchStore.getFileModifications();
    chatStore.setKey('aborted', false);
    runAnimation();

    let messageToSend = currentInput;
    if (fileModifications !== undefined) {
      const diff = fileModificationsToHTML(fileModifications);
      messageToSend = `${diff}\n\nUser request: ${currentInput}`;
      workbenchStore.resetAllFileModifications();
    }

    if (submit) {
      submit(messageToSend);
    }

    setInputValue('');
    // resetEnhancer();
    textareaRef.current?.blur();
  };

  const [messageRef, scrollRef] = useSnapScroll();

  const handleLocalInputChange = (e: React.ChangeEvent<HTMLTextAreaElement> | string) => {
    const newValue = typeof e === 'string' ? e : e.target.value;
    setInputValue(newValue);
  };

  return (
    <BaseChat
      ref={animationScope}
      textareaRef={textareaRef}
      input={inputValue}
      showChat={showChat}
      chatStarted={chatStarted}
      isStreaming={isLoading}
      enhancingPrompt={enhancingPrompt}
      promptEnhanced={promptEnhanced}
      sendMessage={sendMessage}
      messageRef={messageRef}
      scrollRef={scrollRef}
      handleInputChange={handleLocalInputChange}
      handleStop={abort}
      messages={messages}
      enhancePrompt={() => {
        enhancePrompt(inputValue, (newEnhancedInput) => {
          setInputValue(newEnhancedInput);
          requestAnimationFrame(() => { 
            textareaRef.current?.focus(); 
            textareaRef.current?.scrollIntoView({ block: 'end' });
          });
        });
      }}
    />
  );
};