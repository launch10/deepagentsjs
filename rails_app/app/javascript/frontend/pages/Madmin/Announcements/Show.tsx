import { createElement } from "react";
import { Link } from "@inertiajs/react";
import {
  ArrowLeftIcon,
  MegaphoneIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../../layouts/admin-layout";

interface Announcement {
  id: number;
  kind: string;
  title: string;
  published: boolean;
  publishedAt: string | null;
  description: string | null;
  descriptionHtml: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AnnouncementShowProps {
  announcement: Announcement;
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const kindConfig: Record<string, { bg: string; text: string }> = {
    new: { bg: "bg-green-100", text: "text-green-800" },
    fix: { bg: "bg-red-100", text: "text-red-800" },
    improvement: { bg: "bg-blue-100", text: "text-blue-800" },
    update: { bg: "bg-purple-100", text: "text-purple-800" },
  };

  const config = kindConfig[kind] || { bg: "bg-muted", text: "text-muted-foreground" };

  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium capitalize ${config.bg} ${config.text}`}>
      {kind}
    </span>
  );
}

function AnnouncementShow({ announcement }: AnnouncementShowProps) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <Link
          href="/admin/announcements"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Announcements
        </Link>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <MegaphoneIcon className="w-8 h-8 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-foreground">{announcement.title}</h1>
              <KindBadge kind={announcement.kind} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              {announcement.published ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <CheckCircleIcon className="w-3 h-3" />
                  Published
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  <DocumentTextIcon className="w-3 h-3" />
                  Draft
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        {/* Details */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Details</h2>
          <InfoRow label="ID" value={announcement.id} />
          <InfoRow label="Type" value={<KindBadge kind={announcement.kind} />} />
          <InfoRow
            label="Status"
            value={
              announcement.published ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <CheckCircleIcon className="w-4 h-4" />
                  Published
                </span>
              ) : (
                "Draft"
              )
            }
          />
          <InfoRow label="Published At" value={formatDateTime(announcement.publishedAt)} />
        </div>

        {/* Description */}
        {announcement.descriptionHtml && (
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Description</h2>
            <div
              className="prose prose-sm max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: announcement.descriptionHtml }}
            />
          </div>
        )}

        {/* Timestamps */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Timestamps</h2>
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Created" value={formatDateTime(announcement.createdAt)} />
            <InfoRow label="Updated" value={formatDateTime(announcement.updatedAt)} />
          </div>
        </div>
      </div>
    </div>
  );
}

AnnouncementShow.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default AnnouncementShow;
