import { data } from "@remix-run/react";
import type { Message } from "ai";
import { useCallback, useState } from "react";
import { StreamingMessageParser } from "~/lib/runtime/message-parser";
import { workbenchStore } from "~/lib/stores/workbench";
import { createScopedLogger } from "~/lib/utils/logger";

const logger = createScopedLogger("useMessageParser");

const messageParser = new StreamingMessageParser({
  callbacks: {
    // onCodeOpen: (data: CodeCallbackData) => {
    //   logger.info('onCodeOpen', data);

    //   workbenchStore.showWorkbench.set(true);
    //   workbenchStore.addArtifact(data);
    // },
    // onCodeClose: (data: CodeCallbackData) => {
    //   logger.info('onCodeClose', data);

    //   workbenchStore.updateArtifact(data, { closed: true });
    //   workbenchStore.installDependencies(data);
    // },
    onWriteOpen: (data: ActionCallbackData) => {
      logger.info("onWriteOpen", JSON.stringify(data));

      workbenchStore.addAction(data);
    },
    onWriteClose: (data: ActionCallbackData) => {
      logger.info("onWriteClose", JSON.stringify(data));

      workbenchStore.runAction(data);
    },
    // onDependencyClose: (data: ActionCallbackData) => {
    //   logger.info('onDependencyClose', data);

    //   workbenchStore.addAction(data);
    //   workbenchStore.runAction(data);
    // },
    // onRenameClose: (data: ActionCallbackData) => {
    //   logger.info('onRenameClose', data);
    //   workbenchStore.addAction(data);
    //   workbenchStore.runAction(data);
    // },
    // onDeleteClose: (data: ActionCallbackData) => {
    //   logger.info('onDeleteClose', data);

    //   workbenchStore.addAction(data);
    //   workbenchStore.runAction(data);
    // },
  },
});

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  const parseMessages = useCallback((messages: Message[], isLoading: boolean, data: any) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role === "assistant") {
        const newParsedContent = messageParser.parse(message.id, message.content);

        setParsedMessages((prevParsed) => ({
          ...prevParsed,
          [index]: !reset ? (prevParsed[index] || "") + newParsedContent : newParsedContent,
        }));
      }
    }
  }, []);

  return { parsedMessages, parseMessages, messageParser };
}
