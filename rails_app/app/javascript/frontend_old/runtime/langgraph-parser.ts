import {
  ActionType,
  type BoltAction,
  type ParserCallbacks,
  type ActionCallbackData,
} from "./types";
import type { BoltArtifactData } from "~/types/artifact";
import { createScopedLogger } from "~/lib/utils/logger";

const logger = createScopedLogger("LangGraphParser");
export interface LangGraphParserOptions {
  callbacks?: ParserCallbacks;
}

// Tag configuration for attribute extraction and callback mapping
interface TagConfig {
  openTag: string;
  closeTag: string;
  attributes: string[];
  hasContent?: boolean;
  callback: (callbacks: ParserCallbacks | undefined, data: any) => void;
  openCallback: (callbacks: ParserCallbacks | undefined, data: any) => void;
}
interface MessageState {
  position: number;
  insideTag: boolean;
  tagStartedAt: number;
  potentialTag: string;
  insideCode: boolean;
  insideWrite: boolean;
  insideDependency: boolean;
  currentTag?: string;
  currentWrite?: BoltArtifactData;
  currentDependency?: BoltArtifactData;
  actionId: number;
  artifactId: string;
}

export class LangGraphParser {
  #messages = new Map<string, MessageState>();

  // Tag processing configuration
  #tagConfigs: Record<string, TagConfig> = {};
  //   #tagConfigs: Record<string, TagConfig> = {
  //     [WRITE_OPEN_TAG]: {
  //       openTag: WRITE_OPEN_TAG,
  //       closeTag: WRITE_CLOSE_TAG,
  //       attributes: ['filePath'],
  //       hasContent: true,
  //       callback: (callbacks, data) => callbacks?.onWriteClose?.(data),
  //       openCallback: (callbacks, data) => callbacks?.onWriteOpen?.(data)
  //     },
  //     [DEPENDENCY_OPEN_TAG]: {
  //       openTag: DEPENDENCY_OPEN_TAG,
  //       closeTag: DEPENDENCY_CLOSE_TAG,
  //       attributes: ['name', 'version'],
  //       callback: (callbacks, data) => callbacks?.onDependencyClose?.(data),
  //       openCallback: (callbacks, data) => callbacks?.onDependencyOpen?.(data)
  //     },
  //     [RENAME_OPEN_TAG]: {
  //       openTag: RENAME_OPEN_TAG,
  //       closeTag: RENAME_CLOSE_TAG,
  //       attributes: ['filePath', 'newPath'],
  //       callback: (callbacks, data) => callbacks?.onRenameClose?.(data),
  //       openCallback: (callbacks, data) => callbacks?.onRenameOpen?.(data)
  //     },
  //     [DELETE_OPEN_TAG]: {
  //       openTag: DELETE_OPEN_TAG,
  //       closeTag: DELETE_CLOSE_TAG,
  //       attributes: ['filePath'],
  //       callback: (callbacks, data) => callbacks?.onDeleteClose?.(data),
  //       openCallback: (callbacks, data) => callbacks?.onDeleteOpen?.(data)
  //     },
  //     [TEMPLATE_OPEN_TAG]: {
  //       openTag: TEMPLATE_OPEN_TAG,
  //       closeTag: TEMPLATE_CLOSE_TAG,
  //       attributes: ['templateId'],
  //       hasContent: true,
  //       callback: (callbacks, data) => callbacks?.onTemplateClose?.(data),
  //       openCallback: (callbacks, data) => callbacks?.onTemplateOpen?.(data)
  //     }
  //   };

  constructor(private _options: LangGraphParserOptions = {}) {}

  callback(callbackName: keyof ParserCallbacks, data: any) {
    const callbacks = this._options.callbacks;
    callbacks?.[callbackName]?.(data);
  }

  parse(messageId: string, input: string) {
    let state = this.#getOrCreateState(messageId);
    let output = "";
    let i = state.position;

    // while (i < input.length) {
    //   const result = this.#parseNext(state, input, i, messageId);
    //   output += result.output;
    //   const nextPosition = result.nextPosition;
    //   const posDiff = nextPosition - i;
    //   i += posDiff;
    //   state.position += posDiff;

    //   if (result.shouldBreak) {
    //     break;
    //   }
    // }

    return output;
  }

  reset() {
    this.#messages.clear();
  }

  #getOrCreateState(messageId: string): MessageState {
    let state = this.#messages.get(messageId);

    if (!state) {
      state = {
        position: 0,
        tagStartedAt: 0,
        potentialTag: "",
        insideTag: false,
        insideCode: false,
        insideWrite: false,
        insideDependency: false,
        actionId: 1,
        artifactId: "",
      };
      this.#messages.set(messageId, state);
    }

    return state;
  }

  #parseNext(
    state: MessageState,
    input: string,
    position: number,
    messageId: string
  ): { output: string; nextPosition: number; shouldBreak: boolean } {
    if (state.insideCode) {
      return this.#handleInsideCode(state, input, position, messageId);
    }

    return this.#handleOutsideCode(state, input, position, messageId);
  }

  #handleTagClose(
    state: MessageState,
    input: string,
    position: number,
    messageId: string
  ): { output: string; nextPosition: number; shouldBreak: boolean } {
    state.insideTag = false;
    state.potentialTag = "";
    state.tagStartedAt = 0;
    state.currentTag = undefined;
    return { output: "", nextPosition: position + 1, shouldBreak: false };
  }

  #handleInsideCode(
    state: MessageState,
    input: string,
    position: number,
    messageId: string
  ): { output: string; nextPosition: number; shouldBreak: boolean } {
    if (state.currentTag) {
      return this.#handleInsideTag(state, input, position, messageId);
    } else if (state.insideTag || input[position] === "<") {
      if (input[position] === "<") {
        state.insideTag = true;
        state.tagStartedAt = position;
      }
      return this.#handlePotentialTagOpen(state, input, position, messageId);
    }

    return { output: "", nextPosition: position + 1, shouldBreak: false };
  }

  #handleOutsideCode(
    state: MessageState,
    input: string,
    position: number,
    messageId: string
  ): { output: string; nextPosition: number; shouldBreak: boolean } {
    if (state.potentialTag.length > 0 || (input[position] === "<" && input[position + 1] !== "/")) {
      return this.#handlePotentialCodeOpen(state, input, position, messageId);
    }

    return { output: input[position], nextPosition: position + 1, shouldBreak: false };
  }

  #normalizeContent(content: string): string {
    content = content.trim();
    if (content.endsWith("\n")) {
      content += "\n";
    }
    return content;
  }

  #potentialTagMatch(potentialTag: string, tag: string): boolean {
    let len = Math.min(potentialTag.length, tag.length);
    let match = potentialTag.slice(0, len) === tag.slice(0, len);
    return match;
  }

  #handlePotentialCodeOpen(
    state: MessageState,
    input: string,
    position: number,
    messageId: string
  ): { output: string; nextPosition: number; shouldBreak: boolean } {
    let j = position;

    while (j < input.length) {
      state.potentialTag += input[j];

      // We are now sure this is a <lov-code> tag
      if (state.potentialTag.startsWith(CODE_OPEN_TAG) && input[j] === ">") {
        return this.#handleCodeOpen(state, input, position, j, messageId);
      }

      // We are now sure this is NOT a <lov-code> tag
      if (!this.#potentialTagMatch(state.potentialTag, CODE_OPEN_TAG)) {
        const tagToReturn = state.potentialTag;
        state.potentialTag = "";
        return { output: tagToReturn, nextPosition: j + 1, shouldBreak: false };
      }

      j++;
    }

    // We have reached the end of this chunk of the stream
    // If we still MIGHT match, wait until the next chunk of the stream
    if (j === input.length && this.#potentialTagMatch(state.potentialTag, CODE_OPEN_TAG)) {
      return { output: "", nextPosition: j, shouldBreak: true };
    }

    return { output: input.slice(position, j + 1), nextPosition: j, shouldBreak: false };
  }

  #handleCodeOpen(
    state: MessageState,
    input: string,
    position: number,
    j: number,
    messageId: string
  ): { output: string; nextPosition: number; shouldBreak: boolean } {
    const openTagEnd = input.indexOf(">", j);
    if (openTagEnd === -1) {
      return { output: "", nextPosition: position, shouldBreak: true };
    }

    state.insideCode = true;
    const tag = state.potentialTag;
    const artifactId = this.#extractAttribute(tag, "artifactId") || "";
    state.artifactId = artifactId;
    state.potentialTag = "";

    this._options.callbacks?.onCodeOpen?.({ messageId, artifactId });

    return { output: "", nextPosition: openTagEnd + 1, shouldBreak: false };
  }

  #handleInsideTag(
    state: MessageState,
    input: string,
    position: number,
    messageId: string
  ): { output: string; nextPosition: number; shouldBreak: boolean } {
    if (state.currentTag === CODE_CLOSE_TAG) {
      return this.#handleCodeClose(state, input, position, messageId);
    }

    // Unified handler for all other tag types
    const config = this.#tagConfigs[state.currentTag!];
    if (config) {
      return this.#handleGenericTag(state, input, position, messageId, config);
    }

    return { output: "", nextPosition: position + 1, shouldBreak: false };
  }

  // Generic handler for all tag types except code
  #handleGenericTag(
    state: MessageState,
    input: string,
    position: number,
    messageId: string,
    config: TagConfig
  ): { output: string; nextPosition: number; shouldBreak: boolean } {
    const char = input[position];
    state.potentialTag += char;
    const thisTag = state.potentialTag;
    const closingTagPresent = thisTag.includes(config.closeTag);
    const selfClosingRegex = new RegExp(`${config.openTag}[^>]*/>`);
    const isSelfClosingTag = selfClosingRegex.test(thisTag);

    if (char === ">" && (closingTagPresent || isSelfClosingTag)) {
      // Extract all configured attributes
      const data: Record<string, any> = { messageId };
      let action: BoltAction = { data: {} } as BoltAction;

      // Extract attributes from tag
      config.attributes.forEach((attr) => {
        action.data[attr] = this.#extractAttribute(thisTag, attr) || "";
      });

      // Extract content if needed
      if (config.hasContent) {
        action.data.content = this.#normalizeContent(
          this.#extractContent(thisTag, config.openTag) || ""
        );
      }

      // Call the appropriate callback
      data.action = action;
      data.type = this.#normalizeActionName(state.currentTag || "");
      data.artifactId = state.artifactId || "";
      let actionId = state.actionId;
      data.actionId = String(actionId);
      state.actionId = actionId + 1;
      config.callback(this._options.callbacks, data);
      return this.#handleTagClose(state, input, position, messageId);
    }

    return { output: "", nextPosition: position + 1, shouldBreak: false };
  }

  #handlePotentialTagOpen(
    state: MessageState,
    input: string,
    position: number,
    messageId: string
  ): { output: string; nextPosition: number; shouldBreak: boolean } {
    const possibleTags = [
      WRITE_OPEN_TAG,
      DEPENDENCY_OPEN_TAG,
      CODE_CLOSE_TAG,
      RENAME_OPEN_TAG,
      DELETE_OPEN_TAG,
    ];
    state.potentialTag += input[position];
    state.potentialTag = state.potentialTag.trim();

    const matchingTags = possibleTags.filter((tag) => tag.startsWith(state.potentialTag));

    // If we found an exact match for a tag
    if (matchingTags.length === 1 && state.potentialTag === matchingTags[0]) {
      // Handle the specific tag
      state.currentTag = matchingTags[0];

      if (matchingTags[0] === CODE_CLOSE_TAG) {
        return this.#handleCodeClose(state, input, position, messageId);
      }

      // Call the open callback for this tag
      const config = this.#tagConfigs[state.currentTag];
      if (config) {
        const data: ActionCallbackData = { messageId } as ActionCallbackData;

        data.type = this.#normalizeActionName(state.currentTag || "") as ActionType;
        data.artifactId = state.artifactId || "";
        data.actionId = String(state.actionId);
        data.action = {} as BoltAction;
        config.openCallback(this._options.callbacks, data);
      }
    }

    // Not a special tag, just return the current character
    return {
      output: "",
      nextPosition: position + 1,
      shouldBreak: false,
    };
  }

  #handleCodeClose(
    state: MessageState,
    input: string,
    position: number,
    messageId: string
  ): { output: string; nextPosition: number; shouldBreak: boolean } {
    state.insideCode = false;
    state.currentTag = "";
    state.potentialTag = "";
    this._options.callbacks?.onCodeClose?.({
      messageId,
      artifactId: state.artifactId,
      type: "code",
    });
    return { output: "", nextPosition: position + 1, shouldBreak: false };
  }

  #extractAttribute(tag: string, attributeName: string): string | undefined {
    const match = tag.match(new RegExp(`${attributeName}="([^"]*)"`, "i"));
    return match ? match[1] : undefined;
  }

  #extractContent(tag: string, openTag: string): string | undefined {
    const startContent = tag.indexOf(">") + 1;
    const endTag = "</" + openTag.replace("<", "").replace(">", "") + ">";
    const startClosingTag = tag.indexOf(endTag);
    return tag.slice(startContent, startClosingTag);
  }

  #normalizeActionName(tagName: string): string {
    return tagName.replace("<", "").replace(">", "").replace("gen-", "");
  }
}
