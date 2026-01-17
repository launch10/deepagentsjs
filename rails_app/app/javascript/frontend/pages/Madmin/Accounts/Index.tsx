import { createElement } from "react";
import { Link } from "@inertiajs/react";
import {
  BuildingOfficeIcon,
  UserIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../../layouts/admin-layout";

interface Account {
  id: number;
  name: string;
  personal: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
  usersCount: number;
  createdAt: string;
}

interface AccountsIndexProps {
  accounts: Account[];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AccountsIndex({ accounts }: AccountsIndexProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
        <p className="text-muted-foreground mt-1">
          Manage team and personal accounts ({accounts.length} accounts)
        </p>
      </header>

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Name
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Type
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Owner
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Users
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Created
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {account.personal ? (
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <BuildingOfficeIcon className="w-4 h-4 text-primary" />
                    )}
                    <span className="font-medium text-foreground">
                      {account.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      account.personal
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {account.personal ? "Personal" : "Team"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">
                    <div className="text-foreground">{account.ownerName || "—"}</div>
                    <div className="text-muted-foreground text-xs">{account.ownerEmail}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                  {account.usersCount}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(account.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/accounts/${account.id}`}
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

AccountsIndex.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default AccountsIndex;
