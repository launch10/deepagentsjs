import { createElement, useState } from "react";
import { Link, router } from "@inertiajs/react";
import {
  DocumentTextIcon,
  ArrowPathIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../../layouts/admin-layout";

interface Chunk {
  id: number;
  question: string;
  answer: string;
  section: string | null;
  position: number;
}

interface Document {
  id: number;
  title: string;
  slug: string;
  status: string;
  documentType: string;
  sourceType: string;
  sourceUrl: string | null;
  content: string | null;
  metadata: Record<string, unknown>;
  tags: string[];
  chunksCount: number;
  chunks: Chunk[];
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DocumentShowProps {
  document: Document;
  resyncPath: string;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DocumentShow({ document: doc, resyncPath }: DocumentShowProps) {
  const [syncing, setSyncing] = useState(false);

  const handleResync = () => {
    setSyncing(true);
    router.post(resyncPath, {}, { onFinish: () => setSyncing(false) });
  };

  // Group chunks by section
  const chunksBySection = doc.chunks.reduce(
    (acc, chunk) => {
      const section = chunk.section || "General";
      if (!acc[section]) acc[section] = [];
      acc[section].push(chunk);
      return acc;
    },
    {} as Record<string, Chunk[]>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin/documents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Documents
        </Link>
      </div>

      <header className="mb-8 flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <DocumentTextIcon className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{doc.title}</h1>
            <p className="text-muted-foreground mt-1">
              {doc.slug} &middot; {doc.documentType}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                  doc.status === "live"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}
              >
                {doc.status === "live" ? (
                  <CheckCircleIcon className="w-3 h-3" />
                ) : (
                  <ClockIcon className="w-3 h-3" />
                )}
                {doc.status}
              </span>
              {doc.sourceUrl && (
                <a
                  href={doc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <LinkIcon className="w-4 h-4" />
                  View Source
                </a>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleResync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          Re-extract
        </button>
      </header>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-sm text-muted-foreground">Q&A Pairs</div>
          <div className="text-2xl font-bold text-foreground">{doc.chunks.length}</div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-sm text-muted-foreground">Last Synced</div>
          <div className="text-sm font-medium text-foreground">{formatDate(doc.lastSyncedAt)}</div>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="text-sm text-muted-foreground">Updated</div>
          <div className="text-sm font-medium text-foreground">{formatDate(doc.updatedAt)}</div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border shadow-sm">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Extracted Q&A Pairs</h2>
        </div>

        {doc.chunks.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No Q&A pairs extracted yet.</p>
            <button
              onClick={handleResync}
              disabled={syncing}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
              Extract Now
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {Object.entries(chunksBySection).map(([section, chunks]) => (
              <div key={section}>
                <div className="px-4 py-2 bg-muted/50">
                  <h3 className="text-sm font-medium text-muted-foreground">{section}</h3>
                </div>
                <div className="divide-y divide-border/50">
                  {chunks.map((chunk) => (
                    <div key={chunk.id} className="px-4 py-3">
                      <div className="font-medium text-foreground mb-1">Q: {chunk.question}</div>
                      <div className="text-sm text-muted-foreground">A: {chunk.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

DocumentShow.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default DocumentShow;
