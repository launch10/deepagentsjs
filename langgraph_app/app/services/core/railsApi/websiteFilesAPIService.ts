import { RailsAPIBase, type paths } from "@rails_api";
import type { ThreadIDType } from "@types";
import type { Simplify } from "type-fest";

export type WriteFilesRequest = NonNullable<
  paths["/api/v1/websites/{thread_id}/files/write"]["post"]["requestBody"]
>["content"]["application/json"];

export type WriteFilesResponse = NonNullable<
  paths["/api/v1/websites/{thread_id}/files/write"]["post"]["responses"][200]["content"]
>["application/json"];

export type EditFileRequest = NonNullable<
  paths["/api/v1/websites/{thread_id}/files/edit"]["patch"]["requestBody"]
>["content"]["application/json"];

export type EditFileResponse = NonNullable<
  paths["/api/v1/websites/{thread_id}/files/edit"]["patch"]["responses"][200]["content"]
>["application/json"];

export interface WebsiteFile {
  id: number;
  website_id: number;
  path: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface WriteFilesParams {
  threadId: ThreadIDType;
  files: Array<{ path: string; content: string }>;
}

export interface EditFileParams {
  threadId: ThreadIDType;
  path: string;
  oldString: string;
  newString: string;
  replaceAll?: boolean;
}

export interface EditFileResult {
  file: WebsiteFile;
  occurrences: number;
}

export class WebsiteFilesAPIService extends RailsAPIBase {
  constructor(options: Simplify<ConstructorParameters<typeof RailsAPIBase>[0]>) {
    super(options);
  }

  async write({ threadId, files }: WriteFilesParams): Promise<WebsiteFile[]> {
    const client = await this.getClient();
    const response = await client.POST("/api/v1/websites/{thread_id}/files/write", {
      params: {
        path: { thread_id: threadId },
      },
      body: { files },
    });

    if (response.error) {
      throw new Error(`Failed to write files: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to write files: no data returned`);
    }

    return response.data.files;
  }

  async edit({
    threadId,
    path,
    oldString,
    newString,
    replaceAll = false,
  }: EditFileParams): Promise<EditFileResponse> {
    const client = await this.getClient();
    const response = await client.PATCH("/api/v1/websites/{thread_id}/files/edit", {
      params: {
        path: { thread_id: threadId },
      },
      body: {
        path,
        old_string: oldString,
        new_string: newString,
        replace_all: replaceAll,
      },
    });

    if (response.error) {
      throw new Error(`Failed to edit file: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`Failed to edit file: no data returned`);
    }

    return {
      file: response.data.file,
      occurrences: response.data.occurrences,
    };
  }
}
