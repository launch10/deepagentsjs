import { describe, it, expect } from "vitest";
import {
  TaskSchema,
  type TaskStatus,
  type Task,
  createTask,
  findTask,
  updateTask,
} from "@types";

describe("Task type and helpers", () => {
  describe("TaskSchema", () => {
    it("validates a valid async task", () => {
      const task: Task = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "CampaignDeploy",
        jobId: 123,
        status: "pending",
      };

      const result = TaskSchema.safeParse(task);
      expect(result.success).toBe(true);
    });

    it("validates task with result", () => {
      const task: Task = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "CampaignDeploy",
        jobId: 123,
        status: "completed",
        result: { campaign_id: 456, deployed: true },
      };

      const result = TaskSchema.safeParse(task);
      expect(result.success).toBe(true);
    });

    it("validates task with error", () => {
      const task: Task = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "CampaignDeploy",
        jobId: 123,
        status: "failed",
        error: "API rate limit exceeded",
      };

      const result = TaskSchema.safeParse(task);
      expect(result.success).toBe(true);
    });

    it("rejects task with invalid status", () => {
      const task = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "CampaignDeploy",
        status: "invalid_status",
      };

      const result = TaskSchema.safeParse(task);
      expect(result.success).toBe(false);
    });
  });

  describe("createTask", () => {
    it("creates a task with pending status", () => {
      const task = createTask("CampaignDeploy");

      expect(task.name).toBe("CampaignDeploy");
      expect(task.status).toBe("pending");
      expect(task.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(task.jobId).toBeUndefined();
    });

    it("creates a task with jobId", () => {
      const task = createTask("CampaignDeploy", 123);

      expect(task.name).toBe("CampaignDeploy");
      expect(task.jobId).toBe(123);
      expect(task.status).toBe("pending");
    });
  });

  describe("findTask", () => {
    it("finds a task by name", () => {
      const tasks: Task[] = [
        { id: "uuid-1", name: "taskA" as any, status: "pending" },
        { id: "uuid-2", name: "taskB" as any, status: "running" },
        { id: "uuid-3", name: "taskC" as any, status: "completed" },
      ];

      const found = findTask(tasks, "taskB" as any);
      expect(found).toBeDefined();
      expect(found?.name).toBe("taskB");
    });

    it("returns undefined when task not found", () => {
      const tasks: Task[] = [{ id: "uuid-1", name: "taskA" as any, status: "pending" }];

      const found = findTask(tasks, "nonexistent" as any);
      expect(found).toBeUndefined();
    });

    it("returns undefined for empty array", () => {
      const found = findTask([], "any" as any);
      expect(found).toBeUndefined();
    });
  });

  describe("updateTask", () => {
    it("updates a task by name", () => {
      const tasks: Task[] = [
        { id: "uuid-1", name: "taskA" as any, status: "pending" },
        { id: "uuid-2", name: "taskB" as any, status: "pending" },
      ];

      const updated = updateTask(tasks, "taskA" as any, { status: "running" });

      expect(updated[0]?.status).toBe("running");
      expect(updated[1]?.status).toBe("pending");
    });

    it("updates multiple fields", () => {
      const tasks: Task[] = [{ id: "uuid-1", name: "taskA" as any, status: "pending" }];

      const updated = updateTask(tasks, "taskA" as any, {
        status: "completed",
        result: { success: true },
      });

      expect(updated[0]?.status).toBe("completed");
      expect(updated[0]?.result).toEqual({ success: true });
    });

    it("preserves other tasks unchanged", () => {
      const tasks: Task[] = [
        { id: "uuid-1", name: "taskA" as any, status: "pending" },
        { id: "uuid-2", name: "taskB" as any, status: "running", jobId: 123 },
      ];

      const updated = updateTask(tasks, "taskA" as any, { status: "completed" });

      expect(updated[1]).toEqual({
        id: "uuid-2",
        name: "taskB",
        status: "running",
        jobId: 123,
      });
    });

    it("returns original array if task not found", () => {
      const tasks: Task[] = [{ id: "uuid-1", name: "taskA" as any, status: "pending" }];

      const updated = updateTask(tasks, "nonexistent" as any, {
        status: "completed",
      });

      expect(updated).toEqual(tasks);
    });
  });
});
