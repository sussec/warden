"use client";

import {
  History,
  MapPin,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { FindingActivity, FindingActivityType } from "@/client/types.gen";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MarkdownView } from "@/components/markdown/markdown-view";
import { FindingStatusBadge } from "./finding-status-badge";
import type { FindingStatus } from "@/client/types.gen";

const FINDING_STATUSES: ReadonlySet<string> = new Set<FindingStatus>([
  "Open",
  "Confirmed",
  "AcceptedRisk",
  "Fixed",
  "Incorrect",
]);

function isFindingStatus(value: string | null | undefined): value is FindingStatus {
  return !!value && FINDING_STATUSES.has(value);
}

function ActivityIcon({ type }: { type: FindingActivityType }) {
  switch (type) {
    case "Open":
    case "Reopen":
      return <MapPin className="size-4" />;
    case "Fixed":
      return <ShieldCheck className="size-4" />;
    case "Comment":
      return <MessageSquare className="size-4" />;
    case "ChangeStatus":
    case "ChangeSeverity":
      return <RefreshCw className="size-4" />;
    case "ChangeDeadline":
      return <History className="size-4" />;
    default:
      return <RefreshCw className="size-4" />;
  }
}

function ActivityHeadline({ activity }: { activity: FindingActivity }) {
  switch (activity.type) {
    case "ChangeStatus":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span>Changed status</span>
          {isFindingStatus(activity.oldState) && (
            <FindingStatusBadge status={activity.oldState} />
          )}
          {(activity.oldState || activity.newState) && <span>to</span>}
          {isFindingStatus(activity.newState) && (
            <FindingStatusBadge status={activity.newState} />
          )}
        </div>
      );
    case "ChangeSeverity":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span>Changed severity</span>
          {activity.oldState && <span className="font-medium">{activity.oldState}</span>}
          {(activity.oldState || activity.newState) && <span>to</span>}
          {activity.newState && <span className="font-medium">{activity.newState}</span>}
        </div>
      );
    case "ChangeDeadline":
      return (
        <div className="flex flex-wrap items-center gap-2">
          <span>Changed SLA</span>
          {activity.oldState && (
            <span className="rounded border border-border px-2 py-0.5 text-xs">
              {safeDate(activity.oldState)}
            </span>
          )}
          {(activity.oldState || activity.newState) && <span>to</span>}
          {activity.newState && (
            <span className="rounded border border-border px-2 py-0.5 text-xs">
              {safeDate(activity.newState)}
            </span>
          )}
        </div>
      );
    case "Open":
      return <span>First seen</span>;
    case "Reopen":
      return <span>Seen again</span>;
    case "Fixed":
      return <FindingStatusBadge status="Fixed" />;
    case "Comment":
      return <span>Commented</span>;
    default:
      return null;
  }
}

function safeDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "dd/MM/yyyy");
}

/** Vertical activity timeline for a finding (status changes, comments, scans). */
export function FindingActivityTimeline({
  activities,
}: {
  activities: FindingActivity[];
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="relative space-y-6 border-l border-border pl-6">
      {activities.map((activity, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[1.92rem] flex size-8 items-center justify-center rounded-full bg-secondary/15 text-secondary">
            <ActivityIcon type={activity.type} />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Avatar className="size-6">
              {activity.avatar && <AvatarImage src={activity.avatar} alt="" />}
              <AvatarFallback className="text-[10px]">
                {(activity.username ?? "System").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold">{activity.username ?? "System"}</span>
            <time
              className="text-xs text-muted-foreground"
              title={activity.createdAt}
            >
              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
            </time>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            <ActivityHeadline activity={activity} />
            {activity.commit?.branch && (
              <span className="ml-1">
                on{" "}
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {activity.commit.branch}
                </span>
              </span>
            )}
          </div>
          {activity.comment && (
            <div className="mt-2 rounded-md border border-border bg-muted/40 p-3">
              <MarkdownView content={activity.comment} />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
