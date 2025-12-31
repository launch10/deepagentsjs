import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";

export const getMessageText = (message: BaseMessage | undefined): string => {
    if (!message) throw new Error(`couldn't find message`);

    if (isString(message.content)) {
        return message.content;
    } else if (Array.isArray(message.content)) {
        return message.content.map((content) => content.text).join("\n");
    }
    throw new Error(`Don't know how to handle message content type ${typeof message.content}`);
}

export const isHumanMessage = (message: unknown): message is HumanMessage => {
    return HumanMessage.isInstance(message);
}

export const isAIMessage = (message: unknown): message is AIMessage => {
    return AIMessage.isInstance(message);
}

export function isNumber(value: unknown): value is number {
    return typeof value === 'number';
}

export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

export function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

export function isArray(value: unknown): value is any[] {
    return Array.isArray(value);
}

export function isDate(value: unknown): value is Date {
    return value instanceof Date;
}

export function isFunction(value: unknown): value is Function {
    return typeof value === 'function';
}

export function isUndefined(value: unknown): value is undefined {
    return typeof value === 'undefined';
}

export function isNull(value: unknown): value is null {
    return value === null;
}

export function isSymbol(value: unknown): value is symbol {
    return typeof value === 'symbol';
}

export function isError(err: unknown): err is Error {
    return err instanceof Error;
}