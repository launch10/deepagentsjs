import { describe, it, expect } from "vitest";
import {
  asyncTaskSchema,
  AsyncTaskStatus,
  type AsyncTask,
  createAsyncTask,
  findAsyncTask,
  updateAsyncTask,
} from "@types";

describe("AsyncTask type and helpers", () => {
  describe("asyncTaskSchema", () => {
    it("validates a valid async task", () => {
      const task: AsyncTask = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "deployCampaign",
        jobId: 123,
        status: "pending",
      };

      const result = asyncTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
    });

    it("validates task with result", () => {
      const task: AsyncTask = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "deployCampaign",
        jobId: 123,
        status: "completed",
        result: { campaign_id: 456, deployed: true },
      };

      const result = asyncTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
    });

    it("validates task with error", () => {
      const task: AsyncTask = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "deployCampaign",
        jobId: 123,
        status: "failed",
        error: "API rate limit exceeded",
      };

      const result = asyncTaskSchema.safeParse(task);
      expect(result.success).toBe(true);
    });

    it("rejects task with invalid status", () => {
      const task = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "deployCampaign",
        status: "invalid_status",
      };

      const result = asyncTaskSchema.safeParse(task);
      expect(result.success).toBe(false);
    });
  });

  describe("AsyncTaskStatus", () => {
    it("has correct status values", () => {
      expect(AsyncTaskStatus.pending).toBe("pending");
      expect(AsyncTaskStatus.running).toBe("running");
      expect(AsyncTaskStatus.completed).toBe("completed");
      expect(AsyncTaskStatus.failed).toBe("failed");
    });
  });

  describe("createAsyncTask", () => {
    it("creates a task with pending status", () => {
      const task = createAsyncTask("deployCampaign");

      expect(task.name).toBe("deployCampaign");
      expect(task.status).toBe("pending");
      expect(task.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(task.jobId).toBeUndefined();
    });

    it("creates a task with jobId", () => {
      const task = createAsyncTask("deployCampaign", 123);

      expect(task.name).toBe("deployCampaign");
      expect(task.jobId).toBe(123);
      expect(task.status).toBe("pending");
    });
  });

  describe("findAsyncTask", () => {
    it("finds a task by name", () => {
      const tasks: AsyncTask[] = [
        { id: "uuid-1", name: "taskA", status: "pending" },
        { id: "uuid-2", name: "taskB", status: "running" },
        { id: "uuid-3", name: "taskC", status: "completed" },
      ];

      const found = findAsyncTask(tasks, "taskB");
      expect(found).toBeDefined();
      expect(found?.name).toBe("taskB");
    });

    it("returns undefined when task not found", () => {
      const tasks: AsyncTask[] = [
        { id: "uuid-1", name: "taskA", status: "pending" },
      ];

      const found = findAsyncTask(tasks, "nonexistent");
      expect(found).toBeUndefined();
    });

    it("returns undefined for empty array", () => {
      const found = findAsyncTask([], "any");
      expect(found).toBeUndefined();
    });
  });

  describe("updateAsyncTask", () => {
    it("updates a task by name", () => {
      const tasks: AsyncTask[] = [
        { id: "uuid-1", name: "taskA", status: "pending" },
        { id: "uuid-2", name: "taskB", status: "pending" },
      ];

      const updated = updateAsyncTask(tasks, "taskA", { status: "running" });

      expect(updated[0]?.status).toBe("running");
      expect(updated[1]?.status).toBe("pending");
    });

    it("updates multiple fields", () => {
      const tasks: AsyncTask[] = [
        { id: "uuid-1", name: "taskA", status: "pending" },
      ];

      const updated = updateAsyncTask(tasks, "taskA", {
        status: "completed",
        result: { success: true },
      });

      expect(updated[0]?.status).toBe("completed");
      expect(updated[0]?.result).toEqual({ success: true });
    });

    it("preserves other tasks unchanged", () => {
      const tasks: AsyncTask[] = [
        { id: "uuid-1", name: "taskA", status: "pending" },
        { id: "uuid-2", name: "taskB", status: "running", jobId: 123 },
      ];

      const updated = updateAsyncTask(tasks, "taskA", { status: "completed" });

      expect(updated[1]).toEqual({
        id: "uuid-2",
        name: "taskB",
        status: "running",
        jobId: 123,
      });
    });

    it("returns original array if task not found", () => {
      const tasks: AsyncTask[] = [
        { id: "uuid-1", name: "taskA", status: "pending" },
      ];

      const updated = updateAsyncTask(tasks, "nonexistent", {
        status: "completed",
      });

      expect(updated).toEqual(tasks);
    });
  });
});
