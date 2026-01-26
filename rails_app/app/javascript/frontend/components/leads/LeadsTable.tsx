import type { Lead } from "@pages/Leads";

interface LeadsTableProps {
  leads: Lead[];
}

export function LeadsTable({ leads }: LeadsTableProps) {
  return (
    <table className="w-full" data-testid="leads-table">
      <thead className="bg-neutral-50 border-b border-neutral-200">
        <tr>
          <th className="text-left px-6 py-3 text-sm font-medium text-base-700">Name</th>
          <th className="text-left px-6 py-3 text-sm font-medium text-base-700">Email</th>
          <th className="text-left px-6 py-3 text-sm font-medium text-base-700">Date</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => (
          <tr
            key={lead.id}
            className="border-b border-neutral-100 last:border-b-0 hover:bg-neutral-50"
            data-testid="lead-row"
          >
            <td className="px-6 py-4 text-sm text-base-900">
              {lead.name || <span className="text-base-400">&mdash;</span>}
            </td>
            <td className="px-6 py-4 text-sm text-base-900">{lead.email}</td>
            <td className="px-6 py-4 text-sm text-base-500">{lead.date}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
