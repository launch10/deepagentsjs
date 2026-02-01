import { createElement, useState } from "react";
import { Link, router } from "@inertiajs/react";
import {
  DocumentTextIcon,
  ArrowPathIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../../layouts/admin-layout";

interface Document {
  id: number;
  title: string;
  slug: string;
  status: string;
  documentType: string;
  sourceType: string;
  sourceUrl: string | null;
  chunksCount: number;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DocumentsIndexProps {
  documents: Document[];
  syncPath: string;
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

function DocumentsIndex({ documents, syncPath }: DocumentsIndexProps) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = (force: boolean) => {
    setSyncing(true);
    router.post(
      syncPath,
      { force: force.toString() },
      {
        onFinish: () => setSyncing(false),
      }
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground mt-1">
            Manage FAQ documents synced from Google Docs ({documents.length} documents)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSync(false)}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Sync New
          </button>
          <button
            onClick={() => handleSync(true)}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            Force Sync All
          </button>
        </div>
      </header>

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Document
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Chunks
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Last Synced
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <DocumentTextIcon className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium text-foreground">{doc.title}</div>
                      <div className="text-xs text-muted-foreground">{doc.slug}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
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
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      doc.chunksCount > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {doc.chunksCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(doc.lastSyncedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {doc.sourceUrl && (
                      <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Source
                      </a>
                    )}
                    <Link
                      href={`/admin/documents/${doc.id}`}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <EyeIcon className="w-4 h-4" />
                      View
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {documents.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No documents yet. Click "Sync New" to import from Google Docs.</p>
          </div>
        )}
      </div>
    </div>
  );
}

DocumentsIndex.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default DocumentsIndex;
