"use client";

import { cn } from "@/lib/utils";

// Severity palette: security-industry convention (kept from the Angular app).
export const SEVERITY_STYLES: Record<string, { bar: string; text: string }> = {
  Critical: { bar: "bg-critical/20 text-critical", text: "text-critical" },
  High: { bar: "bg-high/20 text-high", text: "text-high" },
  Medium: { bar: "bg-medium/20 text-medium", text: "text-medium" },
  Low: { bar: "bg-low/20 text-low", text: "text-low" },
  Info: { bar: "bg-info/20 text-info", text: "text-info" },
};

export function SeverityBadge({ severity }: { severity?: string | null }) {
  const style = SEVERITY_STYLES[severity ?? ""] ?? {
    bar: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  };
  return (
    <span className={cn("rounded-none px-2 py-0.5 text-xs font-medium tracking-wide", style.bar)}>
      {severity ?? "Unknown"}
    </span>
  );
}

/** Segmented count bar, e.g. Critical/High/Medium/Low/Info per project row. */
export function CountBar({
  segments,
}: {
  segments: { label: string; value: number; className: string }[];
}) {
  return (
    <div className="flex h-7 items-stretch gap-px overflow-hidden rounded-none font-mono">
      {segments.map((s) => (
        <span
          key={s.label}
          title={s.label}
          className={cn(
            "flex flex-1 items-center justify-center text-xs tabular-nums",
            s.className,
          )}
        >
          {s.value}
        </span>
      ))}
    </div>
  );
}
