/**
 * Event Summarization
 *
 * Groups events by category and produces human-readable summaries.
 * Multiple events of the same type get summarized into a single message.
 */

import type { ContextEvent } from "@rails_api";

export interface SummarizedEvent {
  event_type: string;
  message: string;
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

    const parts: string[] = [];

    if (created.length > 0) {
      const filenames = created.map((e) => e.payload.filename as string).filter(Boolean);

      if (created.length <= 3 && filenames.length > 0) {
        parts.push(`uploaded ${filenames.join(", ")}`);
      } else {
        parts.push(`uploaded ${created.length} image${created.length > 1 ? "s" : ""}`);
      }
    }

    if (deleted.length > 0) {
      parts.push(`deleted ${deleted.length} image${deleted.length > 1 ? "s" : ""}`);
    }

    if (parts.length === 0) return null;

    return {
      event_type: "images",
      message: `I ${parts.join(" and ")}`,
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
