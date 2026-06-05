"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Search,
  GitBranch,
  GitMerge,
  Tag,
  PauseCircle,
  Loader2,
  CheckCircle2,
  MinusCircle,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DataTable, type ColumnDef, type PageState } from "@/components/data-table/data-table";
import { ReportExportMenu } from "@/components/findings/report-export-menu";
import { SbomButton } from "@/components/findings/sbom-button";
import { SarifUpload } from "@/components/findings/sarif-upload";
import { ProjectStats } from "@/components/project/project-stats";
import { CountBar } from "@/components/severity";
import { cn } from "@/lib/utils";
import { getProjectCommitScanSummary } from "@/client/sdk.gen";
import type {
  ProjectCommitScanSummary,
  ProjectScanSummary,
  CommitType,
  ScanStatus,
} from "@/client/types.gen";

function BranchLabel({ commit }: { commit: ProjectCommitScanSummary }) {
  const type: CommitType = commit.type;
  const Icon = type === "MergeRequest" ? GitMerge : type === "CommitTag" ? Tag : GitBranch;
  return (
    <span className="flex w-fit flex-row flex-wrap items-center gap-2 rounded bg-secondary/20 px-2 py-0.5 text-xs text-secondary">
      <Icon className="size-3.5" />
      <span>{commit.branch}</span>
      {type === "CommitTag" && <span className="font-semibold">tag</span>}
      {type === "MergeRequest" && (
        <>
          <span className="text-muted-foreground">to</span>
          <span>{commit.targetBranch}</span>
          <span className="font-semibold">MR</span>
        </>
      )}
    </span>
  );
}

function ScanStatusIcon({ status }: { status: ScanStatus }) {
  switch (status) {
    case "Running":
      return <Loader2 className="size-4 animate-spin text-secondary" />;
    case "Completed":
      return <CheckCircle2 className="size-4 text-low" />;
    case "Error":
      return <MinusCircle className="size-4 text-critical" />;
    default:
      return <PauseCircle className="size-4 text-medium" />;
  }
}

function ScanRow({ scan }: { scan: ProjectScanSummary }) {
  const time = scan.completed ?? scan.started;
  return (
    <div className="flex flex-row items-center gap-2 text-xs">
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <ScanStatusIcon status={scan.status} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{scan.status}</TooltipContent>
      </Tooltip>
      <span className="font-medium">{scan.scanner}</span>
      <span className="text-muted-foreground">{scan.type}</span>
      {time && (
        <span className="text-low">{formatDistanceToNow(new Date(time), { addSuffix: true })}</span>
      )}
      {scan.jobUrl && (
        <a href={scan.jobUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}

function sum(scans: ProjectScanSummary[] | null, pick: (s: ProjectScanSummary) => number) {
  return (scans ?? []).reduce((acc, s) => acc + pick(s), 0);
}

export default function ProjectOverviewPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState<PageState>({ page: 1, size: 20 });
  const [name, setName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["project-commits", id, page, name],
    queryFn: async () =>
      (
        await getProjectCommitScanSummary({
          path: { projectId: id },
          body: { page: page.page, size: page.size, name: name || null, desc: true },
          throwOnError: true,
        })
      ).data,
    placeholderData: keepPreviousData,
  });

  const columns: ColumnDef<ProjectCommitScanSummary>[] = [
    {
      key: "commit",
      header: "Commit",
      className: "min-w-64",
      cell: (c) => (
        <div className="flex flex-col gap-1">
          {c.title && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="line-clamp-1 max-w-xs font-medium">{c.title}</span>
              </TooltipTrigger>
              <TooltipContent>{c.title}</TooltipContent>
            </Tooltip>
          )}
          <BranchLabel commit={c} />
        </div>
      ),
    },
    {
      key: "scan",
      header: "Scan",
      className: "min-w-56",
      cell: (c) => (
        <div className="flex flex-col gap-1">
          {(c.scans ?? []).length === 0 ? (
            <span className="text-xs text-muted-foreground">No scans</span>
          ) : (
            c.scans?.map((s, i) => <ScanRow key={i} scan={s} />)
          )}
        </div>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      className: "min-w-40",
      cell: (c) => (
        <CountBar
          segments={[
            { label: "Critical", value: sum(c.scans, (s) => s.critical), className: "bg-critical/20 text-critical" },
            { label: "High", value: sum(c.scans, (s) => s.high), className: "bg-high/20 text-high" },
            { label: "Medium", value: sum(c.scans, (s) => s.medium), className: "bg-medium/20 text-medium" },
            { label: "Low", value: sum(c.scans, (s) => s.low), className: "bg-low/20 text-low" },
          ]}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "min-w-40",
      cell: (c) => (
        <CountBar
          segments={[
            { label: "Open", value: sum(c.scans, (s) => s.open), className: "bg-muted text-muted-foreground" },
            { label: "Confirmed", value: sum(c.scans, (s) => s.confirmed), className: "bg-secondary/20 text-secondary" },
            { label: "Accepted Risk", value: sum(c.scans, (s) => s.ignored), className: "bg-high/20 text-high" },
            { label: "Fixed", value: sum(c.scans, (s) => s.fixed), className: "bg-info/20 text-info" },
          ]}
        />
      ),
    },
    {
      key: "action",
      header: "",
      className: "w-20",
      cell: (c) => (
        <span className="flex items-center gap-1">
          <ReportExportMenu projectId={id} commitId={c.commitId} />
          <Link
            href={`/project/${id}/finding?commitId=${encodeURIComponent(c.commitId)}`}
            className={cn("text-muted-foreground hover:text-foreground")}
            aria-label="View findings for commit"
          >
            <ExternalLink className="size-4" />
          </Link>
        </span>
      ),
    },
  ];

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3">
      {/* header — overview stats + actions pinned at top */}
      <div className="flex shrink-0 flex-col gap-3">
        <ProjectStats projectId={id} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Scan History</h2>
          <div className="flex items-center gap-2">
            <SarifUpload projectId={id} />
            <SbomButton projectId={id} />
          </div>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search commits…"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setPage((p) => ({ ...p, page: 1 }));
            }}
          />
        </div>
      </div>

      {/* scan history table — owns its own scroll, page stays fixed */}
      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm backdrop-blur-md">
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={isLoading}
          count={data?.count}
          pageCount={data?.pageCount}
          page={page}
          onPageChange={setPage}
          emptyMessage="No commits found"
        />
      </div>
    </div>
  );
}
