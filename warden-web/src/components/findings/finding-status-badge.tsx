"use client";

import type { FindingStatus } from "@/client/types.gen";
import { cn } from "@/lib/utils";
import { findingStatusMeta } from "./finding-status";

/** Colored status pill — Open=muted, Confirmed=teal, AcceptedRisk=orange, Fixed=green. */
export function FindingStatusBadge({
  status,
  className,
}: {
  status: FindingStatus;
  className?: string;
}) {
  const meta = findingStatusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold",
        meta.badge,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
