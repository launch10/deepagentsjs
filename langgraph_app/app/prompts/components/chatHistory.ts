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
  let filteredMessages = limit ? messages.slice(-limit) : messages;
  const messageElements = filteredMessages?.map((message) => {
    const type = isHumanMessage(message) ? "human" : "assistant";

    return `\n  <message>${type}: ${JSON.stringify(message.content, null, 4)}</message>`;
  }).join('') || '';
  
  // Don't use renderPrompt here - xml-formatter can reorder elements
  return `<chat-history>${messageElements}\n</chat-history>`;
}