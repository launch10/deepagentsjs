import { createElement } from "react";
import { Link } from "@inertiajs/react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../../layouts/admin-layout";

interface User {
  id: number;
  name: string;
  email: string;
  admin: boolean;
  confirmed: boolean;
  createdAt: string;
}

interface UsersIndexProps {
  users: User[];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function UsersIndex({ users }: UsersIndexProps) {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Users</h1>
        <p className="text-muted-foreground mt-1">
          Manage user accounts ({users.length} users)
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
                Email
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Admin
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Confirmed
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
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {user.name}
                    </span>
                    {user.admin && (
                      <ShieldCheckIcon
                        className="w-4 h-4 text-primary"
                        title="Admin"
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {user.email}
                </td>
                <td className="px-4 py-3 text-center">
                  {user.admin ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <XCircleIcon className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {user.confirmed ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <XCircleIcon className="w-5 h-5 text-amber-500 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/users/${user.id}`}
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

UsersIndex.layout = (page: React.ReactNode) => createElement(AdminLayout, null, page);

export default UsersIndex;
