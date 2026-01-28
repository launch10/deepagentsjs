import { createElement, useState } from "react";
import { Link } from "@inertiajs/react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { AdminLayout } from "~/layouts/admin-layout";

interface CreditTransactionRecord {
  id: number;
  transaction_type: string;
  credit_type: string;
  reason: string;
  amount: number;
  balance_after: number;
  plan_balance_after: number;
  pack_balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

interface Pagination {
  current_page: number;
  total_pages: number;
  total_count: number;
  prev_page: number | null;
  next_page: number | null;
}

interface TransactionsResponse {
  transactions: CreditTransactionRecord[];
  pagination: Pagination;
}

interface CreditTransactionsProps {
  user: { id: number; name: string };
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCredits(credits: number): string {
  return credits.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

function humanize(str: string): string {
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function CreditTransactions({ user }: CreditTransactionsProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery<TransactionsResponse>({
    queryKey: ["creditTransactions", user.id, page],
    queryFn: async () => {
      const res = await fetch(
        `/admin/users/${user.id}/credit_transactions.json?page=${page}`
      );
      if (!res.ok) throw new Error("Failed to fetch credit transactions");
      return res.json();
    },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-8">
        <Link
          href={`/admin/users/${user.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to {user.name}
        </Link>
        <h1 className="text-3xl font-bold text-foreground">
          Credit Transactions
        </h1>
        <p className="text-muted-foreground mt-1">{user.name}</p>
      </header>

      {isLoading && (
        <p className="text-sm text-muted-foreground py-4">
          Loading transactions...
        </p>
      )}

      {isError && (
        <p className="text-sm text-destructive py-4">
          Failed to load transactions.
        </p>
      )}

      {data && data.transactions.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          No transactions yet.
        </p>
      )}

      {data && data.transactions.length > 0 && (
        <div className="bg-card rounded-lg border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3 px-4 font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">
                    Credit Type
                  </th>
                  <th className="py-3 px-4 font-medium text-muted-foreground">
                    Reason
                  </th>
                  <th className="py-3 px-4 font-medium text-muted-foreground text-right">
                    Amount
                  </th>
                  <th className="py-3 px-4 font-medium text-muted-foreground text-right">
                    Balance
                  </th>
                  <th className="py-3 px-4 font-medium text-muted-foreground text-right">
                    Plan Bal
                  </th>
                  <th className="py-3 px-4 font-medium text-muted-foreground text-right">
                    Pack Bal
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-3 px-4 text-foreground">
                      {formatDateTime(txn.created_at)}
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {humanize(txn.transaction_type)}
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {humanize(txn.credit_type)}
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {humanize(txn.reason)}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-medium ${
                        txn.amount >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {txn.amount >= 0 ? "+" : ""}
                      {formatCredits(txn.amount)}
                    </td>
                    <td className="py-3 px-4 text-right text-foreground">
                      {formatCredits(txn.balance_after)}
                    </td>
                    <td className="py-3 px-4 text-right text-foreground">
                      {formatCredits(txn.plan_balance_after)}
                    </td>
                    <td className="py-3 px-4 text-right text-foreground">
                      {formatCredits(txn.pack_balance_after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.pagination.total_pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Page {data.pagination.current_page} of{" "}
                {data.pagination.total_pages} ({data.pagination.total_count}{" "}
                total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={!data.pagination.prev_page}
                  className="px-3 py-1 text-sm rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!data.pagination.next_page}
                  className="px-3 py-1 text-sm rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

CreditTransactions.layout = (page: React.ReactNode) =>
  createElement(AdminLayout, null, page);

export default CreditTransactions;
