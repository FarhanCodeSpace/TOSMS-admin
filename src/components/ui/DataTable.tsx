"use client";

import { type ReactNode, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  // eslint-disable-next-line no-unused-vars
  render: (...args: [T]) => ReactNode;
  // eslint-disable-next-line no-unused-vars
  sortValue?: (...args: [T]) => string | number;
};

type DataTableProps<T> = {
  data: T[];
  columns: DataTableColumn<T>[];
  // eslint-disable-next-line no-unused-vars
  keyExtractor: (...args: [T, number]) => string;
  loading?: boolean;
  pageSize?: number;
  emptyTitle?: string;
  emptySubtitle?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  className?: string;
};

export default function DataTable<T>({
  data,
  columns,
  keyExtractor,
  loading = false,
  pageSize = 10,
  emptyTitle = "No records found",
  emptySubtitle = "Try adjusting your filters.",
  emptyActionLabel,
  onEmptyAction,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    const column = columns.find((item) => item.key === sortKey);
    if (!column?.sortValue) return data;

    const sorted = [...data].sort((a, b) => {
      const first = column.sortValue?.(a);
      const second = column.sortValue?.(b);
      if (first === second) return 0;
      if (first === undefined || first === null) return 1;
      if (second === undefined || second === null) return -1;
      return first > second ? 1 : -1;
    });

    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [columns, data, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const currentRows = sortedData.slice(startIndex, startIndex + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  if (loading) {
    return <SkeletonLoader variant="table" rows={6} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<span className="text-lg font-bold">0</span>}
        title={emptyTitle}
        subtitle={emptySubtitle}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className={cn(
          "overflow-x-auto rounded-lg border",
          "border-[var(--border)]",
          "bg-[var(--surface)]",
          "shadow-md",
        )}
      >
        <table className="min-w-full">
          <thead
            className={cn(
              "sticky top-0 z-10",
              "border-b border-[var(--border)]",
              "bg-[var(--surface-secondary)]",
            )}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide",
                    "text-[var(--text-secondary)]",
                    "hover:text-[var(--text)]",
                    "transition-colors duration-200",
                    column.className ?? "",
                  )}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>{column.header}</span>
                      {sortKey === column.key ? (
                        sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )
                      ) : (
                        <ChevronDown className="h-4 w-4 opacity-30" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, index) => (
              <tr
                key={keyExtractor(row, index)}
                className={cn(
                  "border-b border-[var(--border)] last:border-b-0",
                  "transition-colors duration-150",
                  "hover:bg-[var(--surface-secondary)]",
                  index % 2 === 1 && "bg-[var(--surface-secondary)]/50",
                )}
              >
                {columns.map((column) => (
                  <td
                    key={`${column.key}-${keyExtractor(row, index)}`}
                    className={cn(
                      "px-4 py-3 text-sm text-[var(--text)]",
                      column.className ?? "",
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          Showing {startIndex + 1}-
          {Math.min(startIndex + pageSize, sortedData.length)} of{" "}
          {sortedData.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium",
              "border-[var(--border)] text-[var(--text)]",
              "hover:bg-[var(--surface-secondary)]",
              "transition-colors duration-200",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            Previous
          </button>
          <span className="text-sm text-[var(--text-secondary)] min-w-fit">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-medium",
              "border-[var(--border)] text-[var(--text)]",
              "hover:bg-[var(--surface-secondary)]",
              "transition-colors duration-200",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
