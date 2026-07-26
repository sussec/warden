"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChevronDown, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef, type PageState } from "@/components/data-table/data-table";
import { SeverityBadge } from "@/components/severity";
import { FindingStatusBadge } from "@/components/findings/finding-status-badge";
import { FindingStatusMenu } from "@/components/findings/finding-status-menu";
import { FindingExportMenu } from "@/components/findings/finding-export-menu";
import {
  getFindings,
  getScanners,
  search as semanticSearch,
  updateFinding,
} from "@/client/sdk.gen";
import type {
  FindingFilter,
  FindingSeverity,
  FindingStatus,
  FindingSummary,
  Scanners,
  ScannerType,
  SemanticSearchResult,
} from "@/client/types.gen";

const SEVERITIES: FindingSeverity[] = ["Critical", "High", "Medium", "Low", "Info"];
const SCANNER_TYPES: ScannerType[] = ["Sast", "Dast", "Iast", "Dependency", "Container", "Secret", "Ai", "Cloud"];
const STATUSES: FindingStatus[] = ["Open", "Confirmed", "AcceptedRisk", "Fixed", "Incorrect"];
const STATUS_LABELS: Record<FindingStatus, string> = {
  Open: "Need Triage",
  Confirmed: "Confirmed",
  AcceptedRisk: "Accepted Risk",
  Fixed: "Fixed",
  Incorrect: "False Positive",
};

function isSeverity(v: string): v is FindingSeverity {
  return (SEVERITIES as string[]).includes(v);
}

function FindingListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();

  // Seed severity from ?severity= (e.g. linked from the dashboard).
  const initialSeverity = useMemo<FindingSeverity[]>(() => {
    const raw = searchParams.getAll("severity");
    return raw.filter(isSeverity);
  }, [searchParams]);

  // Seed scanner-category from ?type= (linked from the dashboard coverage panel).
  const initialTypes = useMemo<ScannerType[]>(() => {
    return searchParams.getAll("type").filter((t): t is ScannerType =>
      SCANNER_TYPES.includes(t as ScannerType));
  }, [searchParams]);

  const [page, setPage] = useState<PageState>({ page: 1, size: 20 });
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState<FindingSeverity[]>(initialSeverity);
  const [status, setStatus] = useState<FindingStatus[]>(["Open", "Confirmed"]);
  const [scanner, setScanner] = useState<string[]>([]);
  // Seeded from ?type= (dashboard drill-down); no in-page control yet.
  const [scannerType] = useState<ScannerType[]>(initialTypes);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // AI semantic search
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResults, setAiResults] = useState<SemanticSearchResult[] | null>(null);

  const filter: FindingFilter = useMemo(
    () => ({
      page: page.page,
      size: page.size,
      desc: true,
      name: name || null,
      severity: severity.length ? severity : null,
      status: status.length ? status : null,
      scanner: scanner.length ? scanner : null,
      scannerType: scannerType.length ? scannerType : null,
      sortBy: "CreatedAt",
    }),
    [page, name, severity, status, scanner, scannerType],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["findings", filter],
    queryFn: async () =>
      (await getFindings({ body: filter, throwOnError: true })).data,
    placeholderData: keepPreviousData,
  });

  const { data: scanners } = useQuery({
    queryKey: ["finding-scanners"],
    queryFn: async () =>
      (
        await getScanners({
          body: { type: ["Sast", "Secret"] },
          throwOnError: true,
        })
      ).data,
  });

  const markAs = useMutation({
    mutationFn: async (next: FindingStatus) => {
      const ids = Array.from(selected);
      await Promise.all(
        ids.map((findingId) =>
          updateFinding({
            path: { findingId },
            body: { status: next },
            throwOnError: true,
          }),
        ),
      );
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`Changed status of ${count} finding${count === 1 ? "" : "s"}`);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["findings"] });
    },
    onError: () => toast.error("Failed to update findings"),
  });

  const aiSearch = useMutation({
    mutationFn: async (query: string) =>
      (await semanticSearch({ body: { query }, throwOnError: true })).data,
    onSuccess: (results) => setAiResults(results ?? []),
    onError: () => {
      setAiResults([]);
      toast.error("Semantic search failed");
    },
  });

  const rows = data?.items ?? [];
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(rows.map((r) => r.id)));
    else setSelected(new Set());
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const columns: ColumnDef<FindingSummary>[] = [
    {
      key: "select",
      header: (
        <Checkbox
          checked={allSelected}
          onCheckedChange={(c) => toggleAll(c === true)}
          aria-label="Select all"
        />
      ),
      className: "w-10",
      cell: (f) => (
        <Checkbox
          checked={selected.has(f.id)}
          onCheckedChange={(c) => toggleOne(f.id, c === true)}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select finding"
        />
      ),
    },
    {
      key: "name",
      header: "Finding",
      className: "max-w-md",
      cell: (f) => (
        <Link
          href={`/finding/${f.id}`}
          title={f.name ?? f.identity ?? f.id}
          className="block truncate font-semibold text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {f.name ?? f.identity ?? f.id}
        </Link>
      ),
    },
    {
      key: "scanner",
      header: "Scanner",
      cell: (f) => (
        <div className="flex items-center gap-2">
          {f.scanner && <span className="text-sm">{f.scanner}</span>}
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {f.type}
          </span>
        </div>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      cell: (f) => <SeverityBadge severity={f.severity} />,
    },
    {
      key: "status",
      header: "Status",
      cell: (f) => <FindingStatusBadge status={f.status} />,
    },
  ];

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header + filters — fixed at top */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-bold tracking-tight">Findings</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAiOpen(true)}>
            <Sparkles className="size-4" />
            AI search
          </Button>
          <FindingExportMenu filter={filter} />
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 pl-9"
            placeholder="Search findings…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setPage((p) => ({ ...p, page: 1 }));
            }}
          />
        </div>

        <MultiSelectFilter
          label="Severity"
          options={SEVERITIES.map((s) => ({ value: s, label: s }))}
          selected={severity}
          onChange={(v) => {
            setSeverity(v as FindingSeverity[]);
            setPage((p) => ({ ...p, page: 1 }));
          }}
        />

        <MultiSelectFilter
          label="Status"
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          selected={status}
          onChange={(v) => {
            setStatus(v as FindingStatus[]);
            setPage((p) => ({ ...p, page: 1 }));
          }}
        />

        <Select
          value={scanner[0] ?? "__all"}
          onValueChange={(v) => {
            setScanner(v === "__all" ? [] : [v]);
            setPage((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Scanner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All scanners</SelectItem>
            {(scanners ?? []).map((s: Scanners) => (
              <SelectItem key={s.name ?? s.id} value={s.name ?? "unknown"}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <FindingStatusMenu
            label={`Mark ${selected.size} as`}
            loading={markAs.isPending}
            buttonVariant="secondary"
            onSelect={(s) => markAs.mutate(s)}
          />
        )}
      </div>

      {/* table region — the only thing that scrolls; page stays fixed */}
      <div className="min-h-0 flex-1 overflow-auto rounded-none border border-border bg-card p-3">
        <DataTable
          columns={columns}
          rows={rows}
          loading={isLoading}
          count={data?.count}
          pageCount={data?.pageCount}
          page={page}
          onPageChange={setPage}
          onRowClick={(f) => router.push(`/finding/${f.id}`)}
        />
      </div>

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-secondary" />
              Semantic search
            </DialogTitle>
            <DialogDescription>
              Find findings by meaning, not just keywords.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const q = aiQuery.trim();
              if (q) aiSearch.mutate(q);
            }}
          >
            <Input
              autoFocus
              placeholder="e.g. hardcoded credentials in config files"
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
            />
            <Button type="submit" disabled={aiSearch.isPending || !aiQuery.trim()}>
              {aiSearch.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Search
            </Button>
          </form>

          {aiResults && (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {aiResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matches found.</p>
              ) : (
                aiResults.map((r) => (
                  <Link
                    key={r.id}
                    href={`/finding/${r.id}`}
                    onClick={() => setAiOpen(false)}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-3 hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-primary">
                        {r.name ?? r.id}
                      </p>
                      {r.location && (
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {r.location}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <SeverityBadge severity={r.severity} />
                      <FindingStatusBadge status={r.status} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {(r.score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MultiSelectOption {
  value: string;
  label: string;
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  function toggle(value: string, checked: boolean) {
    if (checked) onChange([...selected, value]);
    else onChange(selected.filter((v) => v !== value));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {label}
          {selected.length > 0 && (
            <span className="rounded bg-secondary/20 px-1.5 text-xs text-secondary">
              {selected.length}
            </span>
          )}
          <ChevronDown className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-2">
        <div className="space-y-1">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={(c) => toggle(opt.value, c === true)}
              />
              <Label className="cursor-pointer font-normal">{opt.label}</Label>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function FindingListPageWrapper() {
  return (
    <Suspense fallback={null}>
      <FindingListPage />
    </Suspense>
  );
}
