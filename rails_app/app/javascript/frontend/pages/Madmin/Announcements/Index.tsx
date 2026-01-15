import { createElement } from "react";
import { Link } from "@inertiajs/react";
import {
  MegaphoneIcon,
  EyeIcon,
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
  createdAt: string;
}

interface AnnouncementsIndexProps {
  announcements: Announcement[];
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "Draft";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function AnnouncementsIndex({ announcements }: AnnouncementsIndexProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Announcements</h1>
        <p className="text-muted-foreground mt-1">
          Manage product announcements ({announcements.length} announcements)
        </p>
      </header>

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Title
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Type
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Published
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {announcements.map((announcement) => (
              <tr
                key={announcement.id}
                className={`hover:bg-muted/30 transition-colors ${
                  !announcement.published ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MegaphoneIcon className="w-4 h-4 text-primary" />
                    <span className="font-medium text-foreground">
                      {announcement.title}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <KindBadge kind={announcement.kind} />
                </td>
                <td className="px-4 py-3 text-center">
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
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(announcement.publishedAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/announcements/${announcement.id}`}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <EyeIcon className="w-4 h-4" />
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

AnnouncementsIndex.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default AnnouncementsIndex;
