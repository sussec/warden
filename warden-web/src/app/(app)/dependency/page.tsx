"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef, type PageState } from "@/components/data-table/data-table";
import { SeverityBadge } from "@/components/severity";
import {
  PackageDetailDrawer,
  type PackageDrawerTarget,
} from "@/components/package/package-detail-drawer";
import { getPackagesByFilter } from "@/client/sdk.gen";
import type { ProjectPackage, RiskLevel, PackageStatus } from "@/client/types.gen";

const SEVERITY_OPTIONS: RiskLevel[] = ["Critical", "High", "Medium", "Low", "None"];
const STATUS_OPTIONS: PackageStatus[] = ["Open", "Ignore", "Fixed"];

const ALL = "__all__";

export default function DependencyListPage() {
  const [page, setPage] = useState<PageState>({ page: 1, size: 20 });
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [drawerTarget, setDrawerTarget] = useState<PackageDrawerTarget | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["packages", page, name, severity, status],
    queryFn: async () =>
      (
        await getPackagesByFilter({
          body: {
            page: page.page,
            size: page.size,
            name: name || null,
            severity: severity === ALL ? null : [severity as RiskLevel],
            status: status === ALL ? undefined : (status as PackageStatus),
            sortBy: "RiskLevel",
            desc: true,
          },
          throwOnError: true,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const columns: ColumnDef<ProjectPackage>[] = [
    {
      key: "name",
      header: "Package",
      cell: (p) => (
        <div className="flex flex-col">
          <span className="font-semibold">
            {p.group ? `${p.group}:` : ""}
            {p.name ?? "Unknown"}
          </span>
          {p.projectName && (
            <span className="text-xs text-muted-foreground">{p.projectName}</span>
          )}
        </div>
      ),
    },
    {
      key: "version",
      header: "Version",
      cell: (p) => (
        <span className="font-mono text-sm">{p.version ?? "—"}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (p) =>
        p.type ? (
          <Badge variant="secondary">{p.type}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "severity",
      header: "Severity",
      cell: (p) => <SeverityBadge severity={p.riskLevel} />,
    },
    {
      key: "impact",
      header: "Impact",
      cell: (p) => (
        <span className="text-muted-foreground">{p.riskImpact}</span>
      ),
    },
    {
      key: "fixedVersion",
      header: "Fixed Version",
      cell: (p) => (
        <span className="font-mono text-sm">{p.fixedVersion ?? "—"}</span>
      ),
    },
  ];

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header + filters — fixed at top */}
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="mr-2 text-lg font-bold tracking-tight">Dependencies</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 bg-card/70 pl-9 backdrop-blur-md"
            placeholder="Search packages…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setPage((p) => ({ ...p, page: 1 }));
            }}
          />
        </div>
        <Select
          value={severity}
          onValueChange={(v) => {
            setSeverity(v);
            setPage((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="w-44 bg-card/70 backdrop-blur-md">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All severities</SelectItem>
            {SEVERITY_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            setPage((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="w-44 bg-card/70 backdrop-blur-md">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* table region — owns the scroll; page stays fixed */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-md">
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={isLoading}
          count={data?.count}
          pageCount={data?.pageCount}
          page={page}
          onPageChange={setPage}
          onRowClick={(p) =>
            setDrawerTarget({
              packageId: p.packageId,
              // Global rows carry a projectId; pass it so status/ticket actions stay enabled.
              projectId: p.projectId || null,
              group: p.group,
              name: p.name,
              version: p.version,
            })
          }
        />
      </div>
      <PackageDetailDrawer
        target={drawerTarget}
        onOpenChange={(open) => {
          if (!open) setDrawerTarget(null);
        }}
      />
    </div>
  );
}
