import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { brainstormInputStore, type BrainstormInputStore } from "../brainstormInput";
import type { Attachment } from "~/types/attachment";
import { UploadService } from "@api/uploads";

// Mock the UploadService
vi.mock("@api/uploads", () => ({
  UploadService: vi.fn(),
}));

// Helper to create a mock file
function createMockFile(name: string, type: string, size = 1024): File {
  const blob = new Blob(["x".repeat(size)], { type });
  return new File([blob], name, { type });
}

// Helper to get a mock for UploadService.prototype.create
function mockUploadService(
  impl?: (attachment: Attachment) => Promise<{
    id: number;
    url: string;
    thumb_url?: string;
    medium_url?: string;
  }>
) {
  const mockCreate = vi.fn().mockImplementation(
    impl ||
      (async () => ({
        id: Math.floor(Math.random() * 1000),
        url: `https://example.com/file`,
        thumb_url: `https://example.com/thumb/file`,
        medium_url: `https://example.com/medium/file`,
      }))
  );

  (UploadService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    create: mockCreate,
  }));

  return mockCreate;
}

// Test JWT
const TEST_JWT = "test-jwt-token";

describe("brainstormInput store", () => {
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset the store state before each test
    brainstormInputStore.getState().reset();
    // Set up default mock
    mockCreate = mockUploadService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("input state", () => {
    it("initializes with empty input", () => {
      expect(brainstormInputStore.getState().input).toBe("");
    });

    it("setInput updates the input value", () => {
      brainstormInputStore.getState().setInput("Hello world");
      expect(brainstormInputStore.getState().input).toBe("Hello world");
    });

    it("setInput can clear the input", () => {
      brainstormInputStore.getState().setInput("Hello");
      brainstormInputStore.getState().setInput("");
      expect(brainstormInputStore.getState().input).toBe("");
    });
  });

  describe("attachments state", () => {
    it("initializes with empty attachments", () => {
      expect(brainstormInputStore.getState().attachments).toEqual([]);
    });

    it("isUploading is false when no attachments", () => {
      expect(brainstormInputStore.getState().isUploading).toBe(false);
    });
  });

  describe("addFiles", () => {
    it("adds valid image files with uploading status", async () => {
      const file = createMockFile("test.png", "image/png");

      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      const { attachments } = brainstormInputStore.getState();
      expect(attachments).toHaveLength(1);
      expect(attachments[0].file).toBe(file);
      expect(attachments[0].status).toBe("uploading");
      expect(attachments[0].type).toBe("image");
      expect(attachments[0].id).toMatch(/^attachment-/);
    });

    it("adds valid PDF files with uploading status", async () => {
      const file = createMockFile("doc.pdf", "application/pdf");

      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      const { attachments } = brainstormInputStore.getState();
      expect(attachments).toHaveLength(1);
      expect(attachments[0].type).toBe("document");
    });

    it("adds multiple files at once", async () => {
      const file1 = createMockFile("test1.png", "image/png");
      const file2 = createMockFile("test2.jpg", "image/jpeg");

      brainstormInputStore.getState().addFiles([file1, file2], TEST_JWT);

      expect(brainstormInputStore.getState().attachments).toHaveLength(2);
    });

    it("sets isUploading to true while uploading", async () => {
      const file = createMockFile("test.png", "image/png");

      // Make upload hang
      mockCreate.mockImplementation(() => new Promise(() => {}));

      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      expect(brainstormInputStore.getState().isUploading).toBe(true);
    });

    it("calls UploadService.create for each valid file", async () => {
      const file1 = createMockFile("test1.png", "image/png");
      const file2 = createMockFile("test2.png", "image/png");

      brainstormInputStore.getState().addFiles([file1, file2], TEST_JWT);

      // Wait for uploads to be called
      await vi.waitFor(() => {
        expect(mockCreate).toHaveBeenCalledTimes(2);
      });
    });

    it("updates attachment to completed status after successful upload", async () => {
      const file = createMockFile("test.png", "image/png");
      mockCreate.mockResolvedValueOnce({
        id: 123,
        url: "https://example.com/test.png",
        thumb_url: "https://example.com/thumb/test.png",
        medium_url: "https://example.com/medium/test.png",
      });

      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      await vi.waitFor(() => {
        const attachment = brainstormInputStore.getState().attachments[0];
        expect(attachment.status).toBe("completed");
        expect(attachment.uploadId).toBe(123);
        expect(attachment.url).toBe("https://example.com/test.png");
        expect(attachment.thumbUrl).toBe("https://example.com/thumb/test.png");
        expect(attachment.mediumUrl).toBe("https://example.com/medium/test.png");
      });
    });

    it("sets isUploading to false after all uploads complete", async () => {
      const file = createMockFile("test.png", "image/png");

      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      await vi.waitFor(() => {
        expect(brainstormInputStore.getState().isUploading).toBe(false);
      });
    });

    it("updates attachment to error status on upload failure", async () => {
      const file = createMockFile("test.png", "image/png");
      mockCreate.mockRejectedValueOnce(new Error("Network error"));

      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      await vi.waitFor(() => {
        const attachment = brainstormInputStore.getState().attachments[0];
        expect(attachment.status).toBe("error");
        expect(attachment.errorMessage).toBe("Network error");
      });
    });

    it("rejects invalid file types with error status", () => {
      const file = createMockFile("test.exe", "application/x-executable");

      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      const { attachments } = brainstormInputStore.getState();
      expect(attachments).toHaveLength(1);
      expect(attachments[0].status).toBe("error");
      expect(attachments[0].errorMessage).toContain("not supported");
    });

    it("does not call UploadService.create for invalid files", () => {
      const file = createMockFile("test.exe", "application/x-executable");

      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      expect(mockCreate).not.toHaveBeenCalled();
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

      brainstormInputStore.getState().addFiles(fileList, TEST_JWT);

      expect(brainstormInputStore.getState().attachments).toHaveLength(1);
    });

    it("passes jwt to UploadService", async () => {
      const file = createMockFile("test.png", "image/png");

      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      expect(UploadService).toHaveBeenCalledWith({ jwt: TEST_JWT });
    });
  });

  describe("removeAttachment", () => {
    it("removes attachment by id", async () => {
      const file = createMockFile("test.png", "image/png");
      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      const attachmentId = brainstormInputStore.getState().attachments[0].id;
      brainstormInputStore.getState().removeAttachment(attachmentId);

      expect(brainstormInputStore.getState().attachments).toHaveLength(0);
    });

    it("does nothing for non-existent id", () => {
      const file = createMockFile("test.png", "image/png");
      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      brainstormInputStore.getState().removeAttachment("non-existent-id");

      expect(brainstormInputStore.getState().attachments).toHaveLength(1);
    });

    it("removes only the specified attachment", () => {
      const file1 = createMockFile("test1.png", "image/png");
      const file2 = createMockFile("test2.png", "image/png");
      brainstormInputStore.getState().addFiles([file1, file2], TEST_JWT);

      const firstId = brainstormInputStore.getState().attachments[0].id;
      brainstormInputStore.getState().removeAttachment(firstId);

      expect(brainstormInputStore.getState().attachments).toHaveLength(1);
      expect(brainstormInputStore.getState().attachments[0].file.name).toBe("test2.png");
    });
  });

  describe("clearAttachments", () => {
    it("removes all attachments", () => {
      const file1 = createMockFile("test1.png", "image/png");
      const file2 = createMockFile("test2.png", "image/png");
      brainstormInputStore.getState().addFiles([file1, file2], TEST_JWT);

      brainstormInputStore.getState().clearAttachments();

      expect(brainstormInputStore.getState().attachments).toEqual([]);
    });

    it("works when already empty", () => {
      brainstormInputStore.getState().clearAttachments();
      expect(brainstormInputStore.getState().attachments).toEqual([]);
    });
  });

  describe("getUploadIds", () => {
    it("returns empty array when no attachments", () => {
      expect(brainstormInputStore.getState().getUploadIds()).toEqual([]);
    });

    it("returns empty array when attachments are still uploading", () => {
      mockCreate.mockImplementation(() => new Promise(() => {}));
      const file = createMockFile("test.png", "image/png");
      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      expect(brainstormInputStore.getState().getUploadIds()).toEqual([]);
    });

    it("returns uploadIds of completed attachments", async () => {
      mockCreate.mockResolvedValueOnce({ id: 123, url: "http://test.com" });
      const file = createMockFile("test.png", "image/png");
      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      await vi.waitFor(() => {
        expect(brainstormInputStore.getState().getUploadIds()).toEqual([123]);
      });
    });

    it("excludes error attachments", async () => {
      mockCreate
        .mockResolvedValueOnce({ id: 123, url: "http://test.com" })
        .mockRejectedValueOnce(new Error("Failed"));

      const file1 = createMockFile("test1.png", "image/png");
      const file2 = createMockFile("test2.png", "image/png");
      brainstormInputStore.getState().addFiles([file1, file2], TEST_JWT);

      await vi.waitFor(() => {
        const ids = brainstormInputStore.getState().getUploadIds();
        expect(ids).toEqual([123]);
      });
    });
  });

  describe("reset", () => {
    it("clears input and attachments", async () => {
      brainstormInputStore.getState().setInput("Hello");
      const file = createMockFile("test.png", "image/png");
      brainstormInputStore.getState().addFiles([file], TEST_JWT);

      await vi.waitFor(() => brainstormInputStore.getState().attachments[0].status === "completed");

      brainstormInputStore.getState().reset();

      expect(brainstormInputStore.getState().input).toBe("");
      expect(brainstormInputStore.getState().attachments).toEqual([]);
    });
  });

  describe("selectors", () => {
    it("allows selective subscription to input only", () => {
      const inputListener = vi.fn();

      brainstormInputStore.subscribe(
        (state: BrainstormInputStore) => state.input,
        inputListener
      );

      // Change input - should trigger
      brainstormInputStore.getState().setInput("test");
      expect(inputListener).toHaveBeenCalledTimes(1);

      // Add file - should NOT trigger (input didn't change)
      const file = createMockFile("test.png", "image/png");
      brainstormInputStore.getState().addFiles([file], TEST_JWT);
      expect(inputListener).toHaveBeenCalledTimes(1);
    });

    it("allows selective subscription to attachments only", async () => {
      const attachmentsListener = vi.fn();

      brainstormInputStore.subscribe(
        (state: BrainstormInputStore) => state.attachments,
        attachmentsListener
      );

      // Change input - should NOT trigger
      brainstormInputStore.getState().setInput("test");
      expect(attachmentsListener).toHaveBeenCalledTimes(0);

      // Add file - should trigger
      const file = createMockFile("test.png", "image/png");
      brainstormInputStore.getState().addFiles([file], TEST_JWT);
      expect(attachmentsListener).toHaveBeenCalledTimes(1);
    });
  });
});
