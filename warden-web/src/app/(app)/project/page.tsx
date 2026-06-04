"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type ColumnDef, type PageState } from "@/components/data-table/data-table";
import { CountBar } from "@/components/severity";
import { getProjectByFilter, getSourceControlSystem } from "@/client/sdk.gen";
import type { ProjectSummary, ProjectSortField } from "@/client/types.gen";

const ALL_SOURCE_CONTROLS = "__all__";

export default function ProjectListPage() {
  const router = useRouter();
  const [page, setPage] = useState<PageState>({ page: 1, size: 20 });
  const [name, setName] = useState("");
  const [sortBy, setSortBy] = useState<ProjectSortField>("CreatedAt");
  const [sourceControlId, setSourceControlId] = useState<string>(ALL_SOURCE_CONTROLS);

  const { data: sourceControls } = useQuery({
    queryKey: ["source-controls"],
    queryFn: async () => (await getSourceControlSystem({ throwOnError: true })).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["projects", page, name, sortBy, sourceControlId],
    queryFn: async () =>
      (
        await getProjectByFilter({
          body: {
            page: page.page,
            size: page.size,
            name: name || null,
            sortBy,
            sourceControlId: sourceControlId === ALL_SOURCE_CONTROLS ? null : sourceControlId,
            desc: true,
          },
          throwOnError: true,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const columns: ColumnDef<ProjectSummary>[] = [
    {
      key: "name",
      header: "Project",
      cell: (p) => (
        <Link href={`/project/${p.id}/overview`} className="font-semibold text-primary hover:underline">
          {p.name}
        </Link>
      ),
    },
    {
      key: "severity",
      header: "Finding Severity",
      className: "min-w-48",
      cell: (p) => (
        <CountBar
          segments={[
            { label: "Critical", value: p.severityCritical, className: "bg-critical/20 text-critical" },
            { label: "High", value: p.severityHigh, className: "bg-high/20 text-high" },
            { label: "Medium", value: p.severityMedium, className: "bg-medium/20 text-medium" },
            { label: "Low", value: p.severityLow, className: "bg-low/20 text-low" },
            { label: "Informative", value: p.severityInfo, className: "bg-info/20 text-info" },
          ]}
        />
      ),
    },
    {
      key: "status",
      header: "Finding Status",
      className: "min-w-40",
      cell: (p) => (
        <CountBar
          segments={[
            { label: "Open", value: p.open, className: "bg-muted text-muted-foreground" },
            { label: "Confirmed", value: p.confirmed, className: "bg-secondary/20 text-secondary" },
            { label: "Accepted Risk", value: p.ignore, className: "bg-high/20 text-high" },
            { label: "Fixed", value: p.fixed, className: "bg-info/20 text-info" },
          ]}
        />
      ),
    },
    {
      key: "createdAt",
      header: "Created At",
      cell: (p) => (
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
        </span>
      ),
    },
  ];

  return (
    <Card className="p-6">
      <h1 className="text-xl font-bold">Projects</h1>
      <div className="my-4 flex flex-wrap items-center gap-3">
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
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as ProjectSortField)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="CreatedAt">created</SelectItem>
            <SelectItem value="UpdatedAt">updated</SelectItem>
            <SelectItem value="Name">name</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sourceControlId}
          onValueChange={(v) => {
            setSourceControlId(v);
            setPage((p) => ({ ...p, page: 1 }));
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Source control" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SOURCE_CONTROLS}>All source controls</SelectItem>
            {sourceControls?.map((sc) => (
              <SelectItem key={sc.id} value={sc.id}>
                {sc.name ?? sc.type}
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
        onRowClick={(p) => router.push(`/project/${p.id}/overview`)}
      />
    </Card>
  );
}
