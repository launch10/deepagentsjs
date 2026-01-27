import { usePage, Link } from "@inertiajs/react";
import { LeadsTable } from "@components/leads/LeadsTable";
import { LeadsPagination } from "@components/leads/LeadsPagination";
import { EmptyLeads } from "@components/leads/EmptyLeads";
import { Button } from "@components/ui/button";
import { ChevronLeft, Download } from "lucide-react";
import type { InertiaProps } from "@shared";

export type LeadsProps =
  InertiaProps.paths["/projects/{uuid}/leads"]["get"]["responses"]["200"]["content"]["application/json"];

export type Lead = LeadsProps["leads"][number];
export type Pagination = LeadsProps["pagination"];

export default function Leads() {
  const { project, leads, pagination } = usePage<LeadsProps>().props;
  const hasLeads = leads.length > 0;

  return (
    <main className="mx-auto container max-w-4xl px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/projects/${project.uuid}/website`}
          className="inline-flex items-center gap-1 text-sm text-base-500 hover:text-base-700 mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Projects
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-base-900">Customer Leads</h1>
            <p className="text-base-500 text-sm mt-1">{project.name}</p>
          </div>
          <a
            href={`/projects/${project.uuid}/leads/export`}
            download={`${project.name}-leads.csv`}
            className={hasLeads ? "" : "pointer-events-none"}
          >
            <Button variant="default" size="sm" disabled={!hasLeads} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>

      {/* Table Container */}
      <div className="border border-neutral-300 bg-white rounded-lg overflow-hidden">
        <LeadsTable leads={leads} />
        {!hasLeads && <EmptyLeads />}
      </div>

      {/* Pagination */}
      <LeadsPagination projectUuid={project.uuid} pagination={pagination} disabled={!hasLeads} />
    </main>
  );
}
