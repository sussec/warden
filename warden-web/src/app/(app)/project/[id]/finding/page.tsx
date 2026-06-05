"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
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
import { getFindings } from "@/client/sdk.gen";
import type { FindingSummary, FindingSeverity, FindingStatus } from "@/client/types.gen";

const SEVERITIES: FindingSeverity[] = ["Critical", "High", "Medium", "Low", "Info"];
const STATUSES: FindingStatus[] = ["Open", "Confirmed", "AcceptedRisk", "Fixed", "Incorrect"];

function ProjectFindingPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const commitId = searchParams.get("commitId");

  const [page, setPage] = useState<PageState>({ page: 1, size: 20 });
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState<FindingSeverity | "all">("all");
  const [status, setStatus] = useState<FindingStatus | "all">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["project-findings", id, commitId, page, name, severity, status],
    queryFn: async () =>
      (
        await getFindings({
          body: {
            page: page.page,
            size: page.size,
            desc: true,
            projectId: id,
            commitId: commitId || null,
            name: name || null,
            severity: severity === "all" ? null : [severity],
            status: status === "all" ? null : [status],
          },
          throwOnError: true,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const columns: ColumnDef<FindingSummary>[] = [
    {
      key: "name",
      header: "Finding",
      className: "max-w-md",
      cell: (f) => (
        <span title={f.name ?? f.identity ?? undefined} className="block truncate font-medium">
          {f.name ?? f.identity}
        </span>
      ),
    },
    {
      key: "scanner",
      header: "Scanner",
      cell: (f) => (
        <div className="flex items-center gap-2">
          <span>{f.scanner}</span>
          <Badge variant="outline">{f.type}</Badge>
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
      cell: (f) => <Badge variant="secondary">{f.status}</Badge>,
    },
  ];

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header + filters */}
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h2 className="mr-1 text-lg font-bold tracking-tight">Findings</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-64 pl-9"
            placeholder="Search…"
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
            setSeverity(v as FindingSeverity | "all");
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
            setStatus(v as FindingStatus | "all");
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
      {/* table region — scrolls; the page itself does not */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-md">
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={isLoading}
          count={data?.count}
          pageCount={data?.pageCount}
          page={page}
          onPageChange={setPage}
          onRowClick={(f) => router.push(`/finding/${f.id}`)}
          emptyMessage="No findings found"
        />
      </div>
    </div>
  );
}

export default function ProjectFindingPage() {
  return (
    <Suspense fallback={null}>
      <ProjectFindingPageInner />
    </Suspense>
  );
}
