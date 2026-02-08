import { Hono } from "hono";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { documentExtractionQueue } from "../../queues/documentExtraction";
import { getLogger } from "@core";

export const documentsRoutes = new Hono();

documentsRoutes.post("/extract-faqs", adminAuthMiddleware, async (c) => {
  const body = await c.req.json();
  const { job_run_id, document_id, content, metadata } = body;

  if (!content || typeof content !== "string") {
    return c.json({ error: "content is required and must be a string" }, 400);
  }

  if (!job_run_id || !document_id) {
    return c.json({ error: "job_run_id and document_id are required" }, 400);
  }

  const job = await documentExtractionQueue.add(`extract-${document_id}`, {
    job_run_id,
    document_id,
    content,
    metadata: metadata || {},
  });

  getLogger().info({ jobId: job.id, documentId: document_id }, "Enqueued document extraction job");

  return c.json({
    status: "queued",
    job_id: job.id,
    job_run_id,
    document_id,
  });
});

documentsRoutes.get("/health", (c) => {
  return c.json({ status: "ok", service: "documents" });
});
