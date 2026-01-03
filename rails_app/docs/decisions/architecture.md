# Architecture: Decision History

> Decisions about service boundaries, data flow, and system architecture. Most recent first.

---

## Current State

Three-tier architecture: Rails Frontend → Langgraph Backend → LLM (Claude).
File uploads stored in Rails (S3 via CarrierWave), referenced by ID in Langgraph.
LLM receives images as multimodal content blocks, documents as text references.

---

## Decision Log

### 2025-12-29: Direct Injection with Single-Message Scope for File Uploads

**Context:** Implementing file uploads in brainstorm chat. Need to decide how uploaded files reach the AI model for analysis.

**Decision:** Use direct injection with single-message scope:
- Images are included as multimodal content blocks in the message they were uploaded with
- Subsequent turns do NOT re-include the images
- Claude's memory carries understanding forward ("they showed me a blue logo")
- PDFs are referenced by filename in text (future: extract text content)

**Why:**
- Brainstorm conversations are brief (<30 messages typically)
- No truncation logic needed at this scale
- Uploads are directly relevant to that turn's context
- Simpler than tool-based or accumulating approaches
- Claude vision works well with direct image injection

**Alternatives considered:**
- **Tool-based viewing**: Model calls `view_image` tool to inspect files. More control but adds complexity and latency. Rejected for simplicity.
- **Accumulate all uploads**: Every message includes all prior uploads. Uses excessive context, overkill for short conversations. Rejected.
- **URL reference only**: Just include URLs as text. Model can't actually see images. Rejected - defeats purpose.

**Trade-offs:**
- If user references an image from 10 messages ago, model relies on memory (acceptable for <30 messages)
- Large images use context window (acceptable - typically only a few brand assets)

**Status:** Current

---

### 2025-12-29: Upload IDs as References Between Rails and Langgraph

**Context:** Files are uploaded to Rails API. Langgraph needs to access them for AI processing.

**Decision:**
- Files upload immediately to Rails `/api/v1/uploads` when selected
- Rails returns Upload objects with IDs and URLs
- Frontend sends `upload_ids: number[]` array with messages to Langgraph
- Langgraph fetches upload metadata by ID, injects into LLM context

**Why:**
- Leverages existing Rails upload infrastructure (CarrierWave, S3)
- Clean separation: Rails owns file storage, Langgraph owns AI orchestration
- IDs are lightweight to pass in message payload
- Langgraph can fetch full details (URL, type, filename) when needed

**Trade-offs:**
- Extra API call from Langgraph to fetch uploads (acceptable - simple HTTP request)
- Upload must complete before message can reference it (mitigated by immediate upload on selection)

**Status:** Current

---
