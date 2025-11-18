import { renderPrompt, toJSON } from '@prompts';
import { type Message, isAIMessage } from "@types";

/**
 * The toolHistory function renders a <tool-history> tag,
 * listing tool calls as <tool-call> sub-elements with "name: args".
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
 * toolHistory({ messages })
 * ```
 */
export async function toolHistoryPrompt({ messages }: { messages: Message[] }): Promise<string> {
    const lastAIResponse = messages.at(-1);
    if (!lastAIResponse || !isAIMessage(lastAIResponse)) {
        return "";
    }
    const toolCalls = lastAIResponse.tool_calls?.map((tc) => {
        return `<tool-call>${tc.name}(${toJSON(tc.args)})</tool-call>`;
    }).join('') || '';

    return renderPrompt(`<tool-history>${toolCalls}</tool-history>`);
}