"use client";

import { useState } from "react";
import { useQuery, keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type ColumnDef, type PageState } from "@/components/data-table/data-table";
import { SeverityBadge } from "@/components/severity";
import { getRuleByFilter, getRuleScanners, updateRule, syncRules } from "@/client/sdk.gen";
import type { RuleInfo, RuleConfidence } from "@/client/types.gen";

const ALL = "__all__";

// Rule confidence maps onto the severity palette for visual parity.
const CONFIDENCE_TO_SEVERITY: Record<RuleConfidence, string> = {
  High: "High",
  Medium: "Medium",
  Low: "Low",
  Unknown: "Info",
};

export default function RuleListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState<PageState>({ page: 1, size: 20 });
  const [name, setName] = useState("");
  const [scannerId, setScannerId] = useState<string>(ALL);

  const { data: scanners } = useQuery({
    queryKey: ["rule-scanners"],
    queryFn: async () => (await getRuleScanners({ throwOnError: true })).data,
    staleTime: 5 * 60_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["rules", page, name, scannerId],
    queryFn: async () =>
      (
        await getRuleByFilter({
          body: {
            page: page.page,
            size: page.size,
            name: name || null,
            scannerId: scannerId === ALL ? null : [scannerId],
            desc: true,
          },
          throwOnError: true,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const toggleMut = useMutation({
    mutationFn: async (rule: RuleInfo) => {
      await updateRule({
        body: {
          ruleId: rule.id ?? "",
          scannerId: rule.scannerId,
          status: rule.status === "Enable" ? "Disable" : "Enable",
        },
        throwOnError: true,
      });
    },
    onSuccess: () => {
      toast.success("Rule updated");
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: () => toast.error("Failed to update rule"),
  });

  const syncMut = useMutation({
    mutationFn: async () => (await syncRules({ throwOnError: true })).data,
    onSuccess: () => {
      toast.success("Rules synced");
      queryClient.invalidateQueries({ queryKey: ["rules"] });
    },
    onError: () => toast.error("Failed to sync rules"),
  });

  const columns: ColumnDef<RuleInfo>[] = [
    {
      key: "id",
      header: "Rule",
      className: "max-w-md",
      cell: (r) => (
        <span title={r.id ?? undefined} className="block truncate font-mono text-sm">
          {r.id ?? "—"}
        </span>
      ),
    },
    {
      key: "scanner",
      header: "Scanner",
      cell: (r) => (
        <span className="inline-flex items-center rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
          {r.scannerName ?? "Unknown"}
        </span>
      ),
    },
    {
      key: "confidence",
      header: "Confidence",
      cell: (r) => <SeverityBadge severity={CONFIDENCE_TO_SEVERITY[r.confidence]} />,
    },
    {
      key: "findings",
      header: "Findings (✓ / ✗ / ?)",
      cell: (r) => (
        <span className="font-mono text-sm tabular-nums">
          <span className="text-primary">{r.correctFinding}</span>
          {" / "}
          <span className="text-critical">{r.incorrectFinding}</span>
          {" / "}
          <span className="text-muted-foreground">{r.uncertainFinding}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Enabled",
      cell: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={r.status === "Enable"}
            disabled={toggleMut.isPending}
            onCheckedChange={() => toggleMut.mutate(r)}
            aria-label="Toggle rule"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header + filters */}
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-medium tracking-tight">Rules</h1>
          <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
            <RefreshCw className={syncMut.isPending ? "size-4 animate-spin" : "size-4"} />
            {syncMut.isPending ? "Syncing…" : "Sync"}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-64 pl-9 bg-card"
              placeholder="Search rules…"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setPage((p) => ({ ...p, page: 1 }));
              }}
            />
          </div>
          <Select
            value={scannerId}
            onValueChange={(v) => {
              setScannerId(v);
              setPage((p) => ({ ...p, page: 1 }));
            }}
          >
            <SelectTrigger className="w-48 bg-card">
              <SelectValue placeholder="Scanner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All scanners</SelectItem>
              {scanners?.map((s) => (
                <SelectItem key={s.id ?? s.name ?? ""} value={s.id ?? s.name ?? "unknown"}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* table region — scrolls inside; page stays fixed */}
      <div className="min-h-0 flex-1 overflow-auto rounded-none border border-border bg-card p-3">
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={isLoading}
          count={data?.count}
          pageCount={data?.pageCount}
          page={page}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
