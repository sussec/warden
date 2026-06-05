"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  FileText,
  GitBranch,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge } from "@/components/severity";
import { MarkdownView } from "@/components/markdown/markdown-view";
import { FindingStatusBadge } from "@/components/findings/finding-status-badge";
import { FindingStatusMenu } from "@/components/findings/finding-status-menu";
import { TicketMenu } from "@/components/findings/ticket-menu";
import { FindingActivityTimeline } from "@/components/findings/finding-activity-timeline";
import { findingStatusMeta } from "@/components/findings/finding-status";
import {
  addComment,
  getFindingActivities,
  getFindingById,
  updateFinding,
} from "@/client/sdk.gen";
import type { FindingDetail, FindingStatus } from "@/client/types.gen";

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="break-all text-sm">{children}</dd>
    </div>
  );
}

function locationLabel(finding: FindingDetail): string | null {
  const { path, startLine, endLine } = finding.location;
  if (!path) return null;
  if (startLine && endLine && endLine !== startLine) return `${path}:${startLine}-${endLine}`;
  if (startLine) return `${path}:${startLine}`;
  return path;
}

function defaultBranch(finding: FindingDetail): string | null {
  const scans = finding.scans ?? [];
  return (scans.find((s) => s.isDefault) ?? scans[0])?.branch ?? null;
}

export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const findingId = params.id;
  const queryClient = useQueryClient();

  const [comment, setComment] = useState("");
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streaming, setStreaming] = useState(false);

  // Stream the AI remediation token-by-token over SSE (same-origin cookie auth).
  async function streamSuggestion() {
    setShowSuggestion(true);
    setStreamText("");
    setStreaming(true);
    try {
      const res = await fetch(`/api/finding/${findingId}/ai-suggestion/stream`, {
        credentials: "same-origin",
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          if (frame.startsWith("event: done")) continue;
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const chunk = line.slice(5).replace(/^ /, "").replace(/\\n/g, "\n");
          if (chunk) setStreamText((t) => t + chunk);
        }
      }
    } catch {
      toast.error("Failed to stream AI suggestion");
    } finally {
      setStreaming(false);
    }
  }

  const { data: finding, isLoading } = useQuery({
    queryKey: ["finding", findingId],
    queryFn: async () =>
      (await getFindingById({ path: { findingId }, throwOnError: true })).data,
  });

  const { data: activityPage } = useQuery({
    queryKey: ["finding-activity", findingId],
    queryFn: async () =>
      (
        await getFindingActivities({
          path: { findingId },
          body: { page: 1, size: 100, desc: true },
          throwOnError: true,
        })
      ).data,
  });

  const changeStatus = useMutation({
    mutationFn: async (next: FindingStatus) =>
      (
        await updateFinding({
          path: { findingId },
          body: { status: next },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      toast.success("Status updated");
      void queryClient.invalidateQueries({ queryKey: ["finding", findingId] });
      void queryClient.invalidateQueries({ queryKey: ["finding-activity", findingId] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  const postComment = useMutation({
    mutationFn: async (text: string) =>
      (
        await addComment({
          path: { findingId },
          body: { comment: text },
          throwOnError: true,
        })
      ).data,
    onSuccess: () => {
      setComment("");
      void queryClient.invalidateQueries({ queryKey: ["finding-activity", findingId] });
    },
    onError: () => toast.error("Failed to post comment"),
  });

  if (isLoading || !finding) {
    return (
      <Card className="space-y-4 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  const location = locationLabel(finding);
  const branch = defaultBranch(finding);
  const snippet = finding.location.snippet;
  const activities = activityPage?.items ?? [];

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="text-xl font-bold">{finding.name ?? finding.identity ?? findingId}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={finding.severity} />
              <FindingStatusBadge status={finding.status} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TicketMenu findingId={findingId} ticket={finding.ticket} />
            <FindingStatusMenu
              label={findingStatusMeta(finding.status).label}
              loading={changeStatus.isPending}
              onSelect={(s) => changeStatus.mutate(s)}
            />
          </div>
        </div>

        <Separator />

        <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetaRow label="Project">
            <Link
              href={`/project/${finding.project.id}/overview`}
              className="text-primary hover:underline"
            >
              {finding.project.name}
            </Link>
          </MetaRow>
          <MetaRow label="Scanner">
            <span>
              {finding.scanner}{" "}
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {finding.type}
              </span>
            </span>
          </MetaRow>
          <MetaRow label="Rule">{finding.ruleId}</MetaRow>
          {location && (
            <MetaRow label="Location">
              <span className="flex items-center gap-1.5 font-mono text-xs">
                <FileText className="size-3.5 text-muted-foreground" />
                {location}
              </span>
            </MetaRow>
          )}
          {branch && (
            <MetaRow label="Branch">
              <span className="flex items-center gap-1.5">
                <GitBranch className="size-3.5 text-muted-foreground" />
                {branch}
              </span>
            </MetaRow>
          )}
          {finding.metadata?.cwes && finding.metadata.cwes.length > 0 && (
            <MetaRow label="CWE">{finding.metadata.cwes.join(", ")}</MetaRow>
          )}
        </dl>
      </Card>

      {finding.description && (
        <Card className="space-y-2 p-6">
          <h2 className="text-base font-bold">Description</h2>
          <MarkdownView content={finding.description} />
        </Card>
      )}

      {snippet && (
        <Card className="space-y-2 p-6">
          <h2 className="text-base font-bold">Code snippet</h2>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm">
            <code>{snippet}</code>
          </pre>
        </Card>
      )}

      {finding.recommendation && (
        <Card className="space-y-2 p-6">
          <h2 className="text-base font-bold">Recommendation</h2>
          <MarkdownView content={finding.recommendation} />
        </Card>
      )}

      <Card className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">AI suggestion</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void streamSuggestion()}
            disabled={streaming}
          >
            {streaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4 text-secondary" />
            )}
            Get AI suggestion
          </Button>
        </div>
        {showSuggestion && (
          <div>
            {streaming && !streamText && (
              <p className="text-sm text-muted-foreground">Generating suggestion…</p>
            )}
            {streamText && (
              <>
                <MarkdownView content={streamText} />
                {streaming && (
                  <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-secondary align-text-bottom" />
                )}
              </>
            )}
            {!streaming && !streamText && (
              <p className="text-sm text-muted-foreground">No suggestion available.</p>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-base font-bold">Activity</h2>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const text = comment.trim();
            if (text) postComment.mutate(text);
          }}
        >
          <Textarea
            placeholder="Add a comment… (Markdown supported)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={postComment.isPending || !comment.trim()}>
              {postComment.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Comment
            </Button>
          </div>
        </form>
        <Separator />
        <FindingActivityTimeline activities={activities} />
      </Card>
    </div>
  );
}
