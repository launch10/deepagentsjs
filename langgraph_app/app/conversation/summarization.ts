/**
 * Event Summarization
 *
 * Groups events by category and produces summaries.
 * Multiple events of the same type get summarized into a single message.
 *
 * Supports both text-only and multimodal (with images) summaries.
 */

import type { ContextEvent } from "@rails_api";

/** Content block types for multimodal messages */
export type TextContent = { type: "text"; text: string };
export type ImageContent = { type: "image_url"; image_url: { url: string } };
export type ContentBlock = TextContent | ImageContent;

export interface SummarizedEvent {
  event_type: string;
  /** For simple text-only summaries */
  message?: string;
  /** For multimodal summaries (images + text) */
  content?: ContentBlock[];
  created_at: string; // Timestamp of LAST event in group
}

/**
 * Group events by category and summarize each group.
 *
 * Input:  [images.created, images.created, images.deleted, images.created]
 * Output: [{ event_type: 'images', message: 'I uploaded 3 images and deleted 1' }]
 */
export function summarizeEvents(events: ContextEvent[]): SummarizedEvent[] {
  if (events.length === 0) return [];

  // Group by event category
  const groups = groupEventsByCategory(events);
  const summaries: SummarizedEvent[] = [];

  for (const [category, categoryEvents] of Object.entries(groups)) {
    const summarizer = SUMMARIZERS[category] ?? defaultSummarizer;
    const summary = summarizer(categoryEvents);
    if (summary) {
      summaries.push(summary);
    }
  }

  // Sort by last event timestamp
  return summaries.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function groupEventsByCategory(events: ContextEvent[]): Record<string, ContextEvent[]> {
  const groups: Record<string, ContextEvent[]> = {};

  for (const event of events) {
    const category = getCategoryKey(event.event_type);
    groups[category] ??= [];
    groups[category].push(event);
  }

  return groups;
}

function getCategoryKey(eventType: string): string {
  // Group related events: images.created + images.deleted -> "images"
  if (eventType.startsWith("images.")) return "images";
  if (eventType.startsWith("brainstorm.")) return "brainstorm";
  if (eventType.startsWith("keywords.")) return "keywords";
  if (eventType.startsWith("theme.")) return "theme";
  if (eventType.startsWith("domain.")) return "domain";
  // Default: use full event type
  return eventType;
}

type Summarizer = (events: ContextEvent[]) => SummarizedEvent | null;

const SUMMARIZERS: Record<string, Summarizer> = {
  images: (events) => {
    const created = events.filter((e) => e.event_type === "images.created");
    const deleted = events.filter((e) => e.event_type === "images.deleted");
    const last = events[events.length - 1]!;

    const content: ContentBlock[] = [];

    if (created.length > 0) {
      // Text intro with filenames AND URLs so the agent uses exact URLs in src attributes
      const imageList = created
        .map((e) => {
          const filename = e.payload.filename as string;
          const url = e.payload.url as string;
          return filename && url ? `- ${filename}: ${url}` : null;
        })
        .filter(Boolean)
        .join("\n");
      content.push({
        type: "text",
        text: `I uploaded ${created.length} image${created.length > 1 ? "s" : ""}:\n${imageList}\n\nUse these exact URLs in img src attributes.`,
      });

      // Add actual image blocks so agent can SEE the images
      for (const event of created) {
        const url = event.payload.url as string;
        if (url) {
          content.push({
            type: "image_url",
            image_url: { url },
          });
        }
      }
    }

    if (deleted.length > 0) {
      // Include filenames so agent knows what paths to remove from code
      const filenames = deleted.map((e) => e.payload.filename as string).filter(Boolean);
      content.push({
        type: "text",
        text: `I deleted ${deleted.length} image${deleted.length > 1 ? "s" : ""}: ${filenames.join(", ")}. Please remove any references to these files.`,
      });
    }

    if (content.length === 0) return null;

    return {
      event_type: "images",
      content,
      created_at: last.created_at,
    };
  },

  brainstorm: (events) => {
    // Use the most recent brainstorm.finished event (should only be one per conversation)
    const finished = events.filter((e) => e.event_type === "brainstorm.finished");
    if (finished.length === 0) return null;

    const last = finished[finished.length - 1]!;
    const payload = last.payload as {
      idea?: string;
      audience?: string;
      solution?: string;
      social_proof?: string;
      theme_name?: string;
    };

    const contextText = `## Brainstorm Context
- Idea: ${payload.idea || "Not provided"}
- Audience: ${payload.audience || "Not provided"}
- Solution: ${payload.solution || "Not provided"}
- Social Proof: ${payload.social_proof || "Not provided"}
${payload.theme_name ? `\n## Theme\nUsing theme: ${payload.theme_name}` : ""}

Please create a landing page based on this context.`;

    return {
      event_type: "brainstorm",
      message: contextText,
      created_at: last.created_at,
    };
  },
};

function defaultSummarizer(events: ContextEvent[]): SummarizedEvent | null {
  if (events.length === 0) return null;
  const last = events[events.length - 1]!;
  return {
    event_type: last.event_type,
    message: `${last.event_type}: ${JSON.stringify(last.payload)}`,
    created_at: last.created_at,
  };
}
