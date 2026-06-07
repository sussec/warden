"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  className?: string;
  cell: (row: T) => React.ReactNode;
}

export interface PageState {
  page: number; // 1-based (API parity)
  size: number;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  rows: T[] | null | undefined;
  loading?: boolean;
  count?: number;
  pageCount?: number;
  page: PageState;
  onPageChange: (page: PageState) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

/** Server-paginated table — Warden's PrimeNG p-table replacement. */
export function DataTable<T>({
  columns,
  rows,
  loading,
  count = 0,
  pageCount = 0,
  page,
  onPageChange,
  onRowClick,
  emptyMessage = "No records found",
}: DataTableProps<T>) {
  const from = count === 0 ? 0 : (page.page - 1) * page.size + 1;
  const to = Math.min(page.page * page.size, count);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* only the table body scrolls; header stays sticky, pagination pinned */}
      <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={cn("uppercase text-xs font-bold", col.className)}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`s-${i}`}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          {!loading && (!rows || rows.length === 0) && (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            rows?.map((row, i) => (
              <TableRow
                key={i}
                // Staggered one-shot entrance: TableRow's .warden-row-reveal
                // fades each row in on mount, offset by --reveal-i. Cap the
                // cascade (index % 12) so long pages don't delay the last rows.
                // CSS handles reduced-motion.
                className={cn(onRowClick && "cursor-pointer")}
                style={{ "--reveal-i": i % 12 } as React.CSSProperties}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.className}>
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
        </TableBody>
      </Table>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-2 text-sm text-muted-foreground">
        <span>
          Showing {from} to {to} of {count}
        </span>
        <Button
          variant="ghost"
          size="icon"
          disabled={page.page <= 1}
          onClick={() => onPageChange({ ...page, page: 1 })}
          aria-label="First page"
        >
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={page.page <= 1}
          onClick={() => onPageChange({ ...page, page: page.page - 1 })}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={page.page >= pageCount}
          onClick={() => onPageChange({ ...page, page: page.page + 1 })}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={page.page >= pageCount}
          onClick={() => onPageChange({ ...page, page: pageCount })}
          aria-label="Last page"
        >
          <ChevronsRight className="size-4" />
        </Button>
        <Select
          value={String(page.size)}
          onValueChange={(v) => onPageChange({ page: 1, size: Number(v) })}
        >
          <SelectTrigger className="w-20" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[10, 20, 50, 100].map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
