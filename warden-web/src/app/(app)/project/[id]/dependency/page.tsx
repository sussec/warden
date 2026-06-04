"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
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
import { getProjectPackages } from "@/client/sdk.gen";
import type { ProjectPackage, PackageStatus, RiskLevel } from "@/client/types.gen";

const STATUSES: PackageStatus[] = ["Open", "Ignore", "Fixed"];
const SEVERITIES: RiskLevel[] = ["Critical", "High", "Medium", "Low", "None"];

const STATUS_VARIANT: Record<PackageStatus, "secondary" | "outline" | "default"> = {
  Open: "secondary",
  Ignore: "outline",
  Fixed: "default",
};

export default function ProjectDependencyPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState<PageState>({ page: 1, size: 20 });
  const [name, setName] = useState("");
  const [status, setStatus] = useState<PackageStatus | "all">("all");
  const [severity, setSeverity] = useState<RiskLevel | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["project-packages", id, page, name, status, severity],
    queryFn: async () =>
      (
        await getProjectPackages({
          path: { projectId: id },
          body: {
            page: page.page,
            size: page.size,
            desc: true,
            name: name || null,
            status: status === "all" ? undefined : status,
            severity: severity === "all" ? null : [severity],
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
      className: "min-w-64",
      cell: (p) => (
        <div className="flex flex-col">
          <span className="font-medium">
            {p.group ? `${p.group}:` : ""}
            {p.name}
          </span>
          <span className="text-xs text-muted-foreground">{p.version}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (p) => (p.type ? <Badge variant="outline">{p.type}</Badge> : null),
    },
    {
      key: "severity",
      header: "Severity",
      cell: (p) => <SeverityBadge severity={p.riskLevel === "None" ? null : p.riskLevel} />,
    },
    {
      key: "impact",
      header: "Impact",
      cell: (p) => <span className="text-muted-foreground">{p.riskImpact}</span>,
    },
    {
      key: "fixedVersion",
      header: "Fixed Version",
      cell: (p) => (
        <span className="text-muted-foreground">{p.fixedVersion ?? "—"}</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Dependencies</h2>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 pl-9"
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
            setSeverity(v as RiskLevel | "all");
            setPage((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as PackageStatus | "all");
            setPage((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={data?.items}
        loading={isLoading}
        count={data?.count}
        pageCount={data?.pageCount}
        page={page}
        onPageChange={setPage}
        emptyMessage="No dependencies found"
      />
    </div>
  );
}
