import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBrainstormInputStore, type BrainstormInputStore } from "../brainstormInput";
import type { Attachment } from "~/types/attachment";

// Helper to create a mock file
function createMockFile(name: string, type: string, size = 1024): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

// Helper to create a mock upload function
function createMockUploadFn() {
  return vi.fn().mockImplementation(async (attachment: Attachment) => ({
    id: Math.floor(Math.random() * 1000),
    url: `https://example.com/${attachment.file.name}`,
    thumb_url: `https://example.com/thumb/${attachment.file.name}`,
    medium_url: `https://example.com/medium/${attachment.file.name}`,
  }));
}

describe("brainstormInput store", () => {
  let store: ReturnType<typeof createBrainstormInputStore>;
  let mockUploadFn: ReturnType<typeof createMockUploadFn>;

  beforeEach(() => {
    mockUploadFn = createMockUploadFn();
    store = createBrainstormInputStore({ uploadFn: mockUploadFn });
  });

  describe("input state", () => {
    it("initializes with empty input", () => {
      expect(store.getState().input).toBe("");
    });

    it("setInput updates the input value", () => {
      store.getState().setInput("Hello world");
      expect(store.getState().input).toBe("Hello world");
    });

    it("setInput can clear the input", () => {
      store.getState().setInput("Hello");
      store.getState().setInput("");
      expect(store.getState().input).toBe("");
    });
  });

  describe("attachments state", () => {
    it("initializes with empty attachments", () => {
      expect(store.getState().attachments).toEqual([]);
    });

    it("isUploading is false when no attachments", () => {
      expect(store.getState().isUploading).toBe(false);
    });
  });

  describe("addFiles", () => {
    it("adds valid image files with uploading status", async () => {
      const file = createMockFile("test.png", "image/png");

      store.getState().addFiles([file]);

      const { attachments } = store.getState();
      expect(attachments).toHaveLength(1);
      expect(attachments[0].file).toBe(file);
      expect(attachments[0].status).toBe("uploading");
      expect(attachments[0].type).toBe("image");
      expect(attachments[0].id).toMatch(/^attachment-/);
    });

    it("adds valid PDF files with uploading status", async () => {
      const file = createMockFile("doc.pdf", "application/pdf");

      store.getState().addFiles([file]);

      const { attachments } = store.getState();
      expect(attachments).toHaveLength(1);
      expect(attachments[0].type).toBe("document");
    });

    it("adds multiple files at once", async () => {
      const file1 = createMockFile("test1.png", "image/png");
      const file2 = createMockFile("test2.jpg", "image/jpeg");

      store.getState().addFiles([file1, file2]);

      expect(store.getState().attachments).toHaveLength(2);
    });

    it("sets isUploading to true while uploading", async () => {
      const file = createMockFile("test.png", "image/png");

      // Make upload hang
      mockUploadFn.mockImplementation(() => new Promise(() => {}));

      store.getState().addFiles([file]);

      expect(store.getState().isUploading).toBe(true);
    });

    it("calls uploadFn for each valid file", async () => {
      const file1 = createMockFile("test1.png", "image/png");
      const file2 = createMockFile("test2.png", "image/png");

      store.getState().addFiles([file1, file2]);

      // Wait for uploads to be called
      await vi.waitFor(() => {
        expect(mockUploadFn).toHaveBeenCalledTimes(2);
      });
    });

    it("updates attachment to completed status after successful upload", async () => {
      const file = createMockFile("test.png", "image/png");
      mockUploadFn.mockResolvedValueOnce({
        id: 123,
        url: "https://example.com/test.png",
        thumb_url: "https://example.com/thumb/test.png",
        medium_url: "https://example.com/medium/test.png",
      });

      store.getState().addFiles([file]);

      await vi.waitFor(() => {
        const attachment = store.getState().attachments[0];
        expect(attachment.status).toBe("completed");
        expect(attachment.uploadId).toBe(123);
        expect(attachment.url).toBe("https://example.com/test.png");
        expect(attachment.thumbUrl).toBe("https://example.com/thumb/test.png");
        expect(attachment.mediumUrl).toBe("https://example.com/medium/test.png");
      });
    });

    it("sets isUploading to false after all uploads complete", async () => {
      const file = createMockFile("test.png", "image/png");

      store.getState().addFiles([file]);

      await vi.waitFor(() => {
        expect(store.getState().isUploading).toBe(false);
      });
    });

    it("updates attachment to error status on upload failure", async () => {
      const file = createMockFile("test.png", "image/png");
      mockUploadFn.mockRejectedValueOnce(new Error("Network error"));

      store.getState().addFiles([file]);

      await vi.waitFor(() => {
        const attachment = store.getState().attachments[0];
        expect(attachment.status).toBe("error");
        expect(attachment.errorMessage).toBe("Network error");
      });
    });

    it("rejects invalid file types with error status", () => {
      const file = createMockFile("test.exe", "application/x-executable");

      store.getState().addFiles([file]);

      const { attachments } = store.getState();
      expect(attachments).toHaveLength(1);
      expect(attachments[0].status).toBe("error");
      expect(attachments[0].errorMessage).toContain("not supported");
    });

    it("does not call uploadFn for invalid files", () => {
      const file = createMockFile("test.exe", "application/x-executable");

      store.getState().addFiles([file]);

      expect(mockUploadFn).not.toHaveBeenCalled();
    });

    it("handles FileList input", () => {
      const file = createMockFile("test.png", "image/png");
      // Create a mock FileList-like object
      const fileList = {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
        [Symbol.iterator]: function* () {
          yield file;
        },
      } as unknown as FileList;

      store.getState().addFiles(fileList);

      expect(store.getState().attachments).toHaveLength(1);
    });
  });

  describe("removeAttachment", () => {
    it("removes attachment by id", async () => {
      const file = createMockFile("test.png", "image/png");
      store.getState().addFiles([file]);

      const attachmentId = store.getState().attachments[0].id;
      store.getState().removeAttachment(attachmentId);

      expect(store.getState().attachments).toHaveLength(0);
    });

    it("does nothing for non-existent id", () => {
      const file = createMockFile("test.png", "image/png");
      store.getState().addFiles([file]);

      store.getState().removeAttachment("non-existent-id");

      expect(store.getState().attachments).toHaveLength(1);
    });

    it("removes only the specified attachment", () => {
      const file1 = createMockFile("test1.png", "image/png");
      const file2 = createMockFile("test2.png", "image/png");
      store.getState().addFiles([file1, file2]);

      const firstId = store.getState().attachments[0].id;
      store.getState().removeAttachment(firstId);

      expect(store.getState().attachments).toHaveLength(1);
      expect(store.getState().attachments[0].file.name).toBe("test2.png");
    });
  });

  describe("clearAttachments", () => {
    it("removes all attachments", () => {
      const file1 = createMockFile("test1.png", "image/png");
      const file2 = createMockFile("test2.png", "image/png");
      store.getState().addFiles([file1, file2]);

      store.getState().clearAttachments();

      expect(store.getState().attachments).toEqual([]);
    });

    it("works when already empty", () => {
      store.getState().clearAttachments();
      expect(store.getState().attachments).toEqual([]);
    });
  });

  describe("getUploadIds", () => {
    it("returns empty array when no attachments", () => {
      expect(store.getState().getUploadIds()).toEqual([]);
    });

    it("returns empty array when attachments are still uploading", () => {
      mockUploadFn.mockImplementation(() => new Promise(() => {}));
      const file = createMockFile("test.png", "image/png");
      store.getState().addFiles([file]);

      expect(store.getState().getUploadIds()).toEqual([]);
    });

    it("returns uploadIds of completed attachments", async () => {
      mockUploadFn.mockResolvedValueOnce({ id: 123, url: "http://test.com" });
      const file = createMockFile("test.png", "image/png");
      store.getState().addFiles([file]);

      await vi.waitFor(() => {
        expect(store.getState().getUploadIds()).toEqual([123]);
      });
    });

    it("excludes error attachments", async () => {
      mockUploadFn
        .mockResolvedValueOnce({ id: 123, url: "http://test.com" })
        .mockRejectedValueOnce(new Error("Failed"));

      const file1 = createMockFile("test1.png", "image/png");
      const file2 = createMockFile("test2.png", "image/png");
      store.getState().addFiles([file1, file2]);

      await vi.waitFor(() => {
        const ids = store.getState().getUploadIds();
        expect(ids).toEqual([123]);
      });
    });
  });

  describe("reset", () => {
    it("clears input and attachments", async () => {
      store.getState().setInput("Hello");
      const file = createMockFile("test.png", "image/png");
      store.getState().addFiles([file]);

      await vi.waitFor(() => store.getState().attachments[0].status === "completed");

      store.getState().reset();

      expect(store.getState().input).toBe("");
      expect(store.getState().attachments).toEqual([]);
    });
  });

  describe("selectors", () => {
    it("allows selective subscription to input only", () => {
      const inputListener = vi.fn();

      store.subscribe(
        (state) => state.input,
        inputListener
      );

      // Change input - should trigger
      store.getState().setInput("test");
      expect(inputListener).toHaveBeenCalledTimes(1);

      // Add file - should NOT trigger (input didn't change)
      const file = createMockFile("test.png", "image/png");
      store.getState().addFiles([file]);
      expect(inputListener).toHaveBeenCalledTimes(1);
    });

    it("allows selective subscription to attachments only", async () => {
      const attachmentsListener = vi.fn();

      store.subscribe(
        (state) => state.attachments,
        attachmentsListener
      );

      // Change input - should NOT trigger
      store.getState().setInput("test");
      expect(attachmentsListener).toHaveBeenCalledTimes(0);

      // Add file - should trigger
      const file = createMockFile("test.png", "image/png");
      store.getState().addFiles([file]);
      expect(attachmentsListener).toHaveBeenCalledTimes(1);
    });
  });
});
