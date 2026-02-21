import { createElement, useState } from "react";
import { router } from "@inertiajs/react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { AdminLayout } from "../../../layouts/admin-layout";

interface FFUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
  has_logged_in: boolean;
  pack_credits: number;
  total_credits: number;
}

interface FriendsAndFamilyIndexProps {
  users: FFUser[];
  flash?: { notice?: string; alert?: string };
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function creditsToDollars(credits: number): string {
  return `$${(credits / 100).toFixed(2)}`;
}

function FriendsAndFamilyIndex({ users }: FriendsAndFamilyIndexProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState("500");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    router.post(
      "/admin/friends_and_family",
      {
        friends_and_family: { name, email, credits: parseInt(credits, 10) },
      },
      {
        onFinish: () => {
          setSubmitting(false);
          setName("");
          setEmail("");
          setCredits("500");
        },
      }
    );
  };

  const handleResend = (userId: number) => {
    router.post(`/admin/friends_and_family/${userId}/resend`);
  };

  const handleRevoke = (userId: number, email: string) => {
    if (confirm(`Revoke subscription for ${email}?`)) {
      router.post(`/admin/friends_and_family/${userId}/revoke`);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Friends & Family
        </h1>
        <p className="text-muted-foreground mt-1">
          Invite testers and manage their accounts
        </p>
      </header>

      {/* Invite Form */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Send Invitation
        </h2>
        <form onSubmit={handleSubmit} className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              placeholder="Jane Doe"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              placeholder="jane@example.com"
            />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Credits ({creditsToDollars(parseInt(credits, 10) || 0)} AI spend)
            </label>
            <input
              type="number"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? "Sending..." : "Send Invite"}
          </button>
        </form>
      </div>

      {/* Users Table */}
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
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                Credits
              </th>
              <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                Logged In
              </th>
              <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                Invited
              </th>
              <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No friends & family users yet. Send your first invite above.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {user.name}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {user.email}
                </td>
                <td className="px-4 py-3 text-sm text-right text-foreground">
                  {user.total_credits.toLocaleString()}
                  <span className="text-muted-foreground ml-1">
                    ({creditsToDollars(user.total_credits)})
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {user.has_logged_in ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <XCircleIcon className="w-5 h-5 text-muted-foreground/50 mx-auto" />
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button
                    onClick={() => handleResend(user.id)}
                    className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    Resend
                  </button>
                  <button
                    onClick={() => handleRevoke(user.id, user.email)}
                    className="inline-flex items-center gap-1 text-sm text-red-500 hover:text-red-400 transition-colors"
                  >
                    <XCircleIcon className="w-4 h-4" />
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

FriendsAndFamilyIndex.layout = (page: React.ReactNode) =>
  createElement(AdminLayout, null, page);

export default FriendsAndFamilyIndex;
