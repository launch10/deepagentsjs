import {
  HumanMessage,
  type BaseMessage,
  type MessageContent,
  type MessageContentComplex,
  type MessageContentImageUrl,
  type MessageContentText,
} from "@langchain/core/messages";
import { UploadsAPIService, type GetUploadsResponse } from "@rails_api";
import { isHumanMessage } from "@types";

/** Type for individual upload from GetUploadsResponse array */
type UploadItem = GetUploadsResponse[number];

/**
 * Service for injecting uploaded files into messages as multimodal content.
 *
 * Per architecture decision (2025-12-29):
 * - Images are included as multimodal content blocks in the message they were uploaded with
 * - Subsequent turns do NOT re-include the images (single-message scope)
 * - Claude's memory carries understanding forward
 */
export class UploadInjectionService {
  private jwt: string;

  constructor(jwt: string) {
    this.jwt = jwt;
  }

  /**
   * Injects uploads into the last human message as multimodal content blocks.
   *
   * @param messages - The message array
   * @param uploadIds - IDs of uploads to inject
   * @returns Modified message array with uploads injected into last human message
   */
  async injectUploads(messages: BaseMessage[], uploadIds: number[]): Promise<BaseMessage[]> {
    if (!uploadIds || uploadIds.length === 0) {
      return messages;
    }

    // Find the last human message
    const lastHumanIndex = this.findLastHumanMessageIndex(messages);
    if (lastHumanIndex === -1) {
      return messages;
    }

    // Fetch uploads from Rails
    const uploads = await this.fetchUploads(uploadIds);
    if (uploads.length === 0) {
      return messages;
    }

    // Convert uploads to content blocks
    const uploadContentBlocks = this.uploadsToContentBlocks(uploads);
    if (uploadContentBlocks.length === 0) {
      return messages;
    }

    // Create a new message array with modified last human message
    const newMessages = [...messages];
    const lastHumanMessage = messages[lastHumanIndex] as HumanMessage;

    // Get existing content as array
    const existingContent = this.normalizeContent(lastHumanMessage.content);

    // Combine existing content with upload content blocks
    const newContent = [...existingContent, ...uploadContentBlocks];

    // Create new HumanMessage with combined content
    // Use type assertion as LangChain's MessageContent type is compatible at runtime
    newMessages[lastHumanIndex] = new HumanMessage({
      content: newContent as MessageContent,
      additional_kwargs: lastHumanMessage.additional_kwargs,
      response_metadata: lastHumanMessage.response_metadata,
    });

    return newMessages;
  }

  /**
   * Find the index of the last human message in the array
   */
  private findLastHumanMessageIndex(messages: BaseMessage[]): number {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (isHumanMessage(messages[i])) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Fetch uploads from Rails API by IDs
   */
  private async fetchUploads(uploadIds: number[]): Promise<GetUploadsResponse> {
    try {
      const uploadsService = new UploadsAPIService({ jwt: this.jwt });
      return await uploadsService.getByIds(uploadIds);
    } catch (error) {
      console.error("[UploadInjectionService] Failed to fetch uploads:", error);
      return [];
    }
  }

  /**
   * Convert uploads to LangChain multimodal content blocks
   */
  private uploadsToContentBlocks(uploads: GetUploadsResponse): MessageContentComplex[] {
    const blocks: MessageContentComplex[] = [];

    for (const upload of uploads) {
      if (upload.media_type === "image") {
        // Images are injected as image_url content blocks
        const imageBlock: MessageContentImageUrl = {
          type: "image_url",
          image_url: {
            url: upload.url,
            detail: "auto",
          },
        };
        blocks.push(imageBlock);
      } else if (upload.media_type === "document") {
        // Documents are referenced by filename in text (future: extract text content)
        const textBlock: MessageContentText = {
          type: "text",
          text: `[Attached document: ${upload.filename}]`,
        };
        blocks.push(textBlock);
      }
      // Videos are not currently supported for multimodal
    }

    return blocks;
  }

  /**
   * Normalize message content to array format
   */
  private normalizeContent(content: MessageContent): MessageContentComplex[] {
    if (typeof content === "string") {
      return [{ type: "text", text: content }];
    }
    // Content is already an array
    return content as MessageContentComplex[];
  }
}
