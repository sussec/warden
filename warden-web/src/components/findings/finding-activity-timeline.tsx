"use client";

import {
  type LucideIcon,
  CalendarClock,
  GitCommitHorizontal,
  MapPin,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  SignalHigh,
  Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { FindingActivity, FindingActivityType, FindingStatus } from "@/client/types.gen";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MarkdownView } from "@/components/markdown/markdown-view";
import { FindingStatusBadge } from "./finding-status-badge";

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

/** Per-type node icon + colour token (theme-safe — resolves in light & dark). */
const TYPE_META: Record<FindingActivityType, { icon: LucideIcon; color: string }> = {
  Open: { icon: MapPin, color: "var(--primary)" },
  Reopen: { icon: RotateCcw, color: "var(--severity-high)" },
  Fixed: { icon: ShieldCheck, color: "var(--severity-info)" },
  Comment: { icon: MessageSquare, color: "var(--muted-foreground)" },
  ChangeStatus: { icon: RefreshCw, color: "var(--primary)" },
  ChangeSeverity: { icon: SignalHigh, color: "var(--severity-medium)" },
  ChangeDeadline: { icon: CalendarClock, color: "var(--muted-foreground)" },
};

function safeDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "dd/MM/yyyy");
}

function absoluteTime(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : format(d, "PPpp");
}

/** AI-triage system comments carry a "[AI Triage] VERDICT (NN%) — detail" shape. */
function parseAiTriage(comment: string) {
  const m = comment.match(/^\[AI Triage\]\s*([A-Z_]+)\s*(?:\((\d+)%\))?\s*(?:[—-]\s*)?([\s\S]*)$/);
  if (!m) return null;
  return { verdict: m[1].replace(/_/g, " "), confidence: m[2], detail: m[3]?.trim() ?? "" };
}

function ActivityHeadline({ activity }: { activity: FindingActivity }) {
  switch (activity.type) {
    case "ChangeStatus":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">changed status</span>
          {isFindingStatus(activity.oldState) && <FindingStatusBadge status={activity.oldState} />}
          {(activity.oldState || activity.newState) && (
            <span className="text-muted-foreground">→</span>
          )}
          {isFindingStatus(activity.newState) && <FindingStatusBadge status={activity.newState} />}
        </span>
      );
    case "ChangeSeverity":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">changed severity</span>
          {activity.oldState && <span className="font-medium">{activity.oldState}</span>}
          {(activity.oldState || activity.newState) && (
            <span className="text-muted-foreground">→</span>
          )}
          {activity.newState && <span className="font-medium">{activity.newState}</span>}
        </span>
      );
    case "ChangeDeadline":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground">changed SLA</span>
          {activity.oldState && (
            <span className="rounded border border-border px-1.5 py-0.5 text-xs">
              {safeDate(activity.oldState)}
            </span>
          )}
          {(activity.oldState || activity.newState) && (
            <span className="text-muted-foreground">→</span>
          )}
          {activity.newState && (
            <span className="rounded border border-border px-1.5 py-0.5 text-xs">
              {safeDate(activity.newState)}
            </span>
          )}
        </span>
      );
    case "Open":
      return <span className="font-medium">First seen</span>;
    case "Reopen":
      return <span className="font-medium">Seen again</span>;
    case "Fixed":
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">marked</span>
          <FindingStatusBadge status="Fixed" />
        </span>
      );
    case "Comment":
      return <span className="text-muted-foreground">commented</span>;
    default:
      return null;
  }
}

/** One timeline entry. */
function ActivityNode({
  activity,
  last,
  index,
}: {
  activity: FindingActivity;
  last: boolean;
  index: number;
}) {
  const isSystem = !activity.username || activity.username === "System";
  const ai =
    activity.type === "Comment" && activity.comment ? parseAiTriage(activity.comment) : null;
  const meta = ai
    ? { icon: Sparkles, color: "var(--primary)" }
    : TYPE_META[activity.type] ?? { icon: RefreshCw, color: "var(--muted-foreground)" };
  const Icon = meta.icon;

  return (
    <li
      className="warden-reveal relative flex gap-4 pb-6 last:pb-0"
      style={{ "--reveal-i": Math.min(index, 12) } as React.CSSProperties}
    >
      {/* rail: node dot + connector line */}
      <div className="relative flex flex-col items-center">
        <span
          className="z-10 flex size-9 shrink-0 items-center justify-center rounded-none border"
          style={{
            color: meta.color,
            background: `color-mix(in oklab, ${meta.color} 14%, transparent)`,
            borderColor: `color-mix(in oklab, ${meta.color} 38%, transparent)`,
          }}
        >
          <Icon className="size-4" />
        </span>
        {!last && (
          <span className="absolute top-9 bottom-[-1.5rem] w-px bg-gradient-to-b from-border to-border/30" />
        )}
      </div>

      {/* content */}
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {isSystem ? (
            <span className="flex size-5 items-center justify-center rounded-none bg-muted text-muted-foreground">
              <Server className="size-3" />
            </span>
          ) : (
            <Avatar className="size-5">
              {activity.avatar && <AvatarImage src={activity.avatar} alt="" />}
              <AvatarFallback className="text-[9px]">
                {(activity.username ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          <span className="text-sm font-semibold">{activity.username ?? "System"}</span>
          <span className="text-sm">
            {ai ? (
              <span className="text-muted-foreground">ran AI triage</span>
            ) : (
              <ActivityHeadline activity={activity} />
            )}
          </span>
          {activity.commit?.branch && (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              <GitCommitHorizontal className="size-3" />
              {activity.commit.branch}
            </span>
          )}
          <time
            className="ml-auto shrink-0 text-xs text-muted-foreground"
            dateTime={activity.createdAt}
            title={absoluteTime(activity.createdAt)}
          >
            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
          </time>
        </div>

        {/* AI triage verdict card */}
        {ai && (
          <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-none bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                <Sparkles className="size-3" />
                {ai.verdict}
              </span>
              {ai.confidence !== undefined && (
                <span className="text-xs text-muted-foreground">{ai.confidence}% confidence</span>
              )}
            </div>
            {ai.detail && <p className="mt-1.5 text-sm text-muted-foreground">{ai.detail}</p>}
          </div>
        )}

        {/* regular comment card */}
        {!ai && activity.comment && (
          <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <MarkdownView content={activity.comment} />
          </div>
        )}
      </div>
    </li>
  );
}

/** Vertical activity timeline for a finding (status changes, comments, scans, AI triage). */
export function FindingActivityTimeline({ activities }: { activities: FindingActivity[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="relative">
      {activities.map((activity, i) => (
        <ActivityNode
          key={i}
          activity={activity}
          last={i === activities.length - 1}
          index={i}
        />
      ))}
    </ol>
  );
}
