import { renderPrompt } from '@prompts';
import { type Message, isHumanMessage, isAIMessage } from "@types";

/**
 * The chatHistory function renders a <chat-history> tag,
 * listing messages as <message> sub-elements with "role: content".
 *
 * @param messages - An array of message objects with "role" and "content".
 *
 * @example
 * ```ts
 * const messages = [
 *   { role: 'system', content: 'You are a helpful AI assistant.' },
 *   { role: 'user', content: 'Hello!' }
 * ];
 *
 * chatHistory({ messages })
 * ```
 */
export async function chatHistoryPrompt({ messages, limit }: { messages: Message[], limit?: number }): Promise<string> {
  const allowedMessages = messages.filter((m) => typeof m.content === 'string')
  let countExtraMessages = allowedMessages.length - (limit || 0);
  let filteredMessages = limit ? allowedMessages.slice(-limit) : allowedMessages;
  let messageElements = filteredMessages?.map((message) => {
    const type = isHumanMessage(message) ? "human" : "assistant";

    return `\n  <message>${type}: ${JSON.stringify(message.content, null, 4)}</message>`;
  });

  if (countExtraMessages > 0) {
    messageElements.unshift(`\n  <message>... ${countExtraMessages} more messages...</message>`);
  }
  
  // Don't use renderPrompt here - xml-formatter can reorder elements
  return `<chat-history>${messageElements.join('')}\n</chat-history>`;
}