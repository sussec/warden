"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: string;
  description?: string;
  /** Public path under /dashboard/ */
  image?: "empty-secure" | "pipeline-hud" | "mark";
  className?: string;
  compact?: boolean;
};

const SRC: Record<NonNullable<EmptyStateProps["image"]>, string> = {
  "empty-secure": "/dashboard/empty-secure.jpg",
  "pipeline-hud": "/dashboard/pipeline-hud.jpg",
  mark: "/dashboard/mark.jpg",
};

/** Illustrated empty / idle state for the ops dashboard. */
export function EmptyState({
  title,
  description,
  image = "empty-secure",
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-6" : "gap-3 py-10",
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-none border border-border bg-card",
          compact ? "size-20" : "size-28 sm:size-32",
        )}
      >
        <Image
          src={SRC[image]}
          alt=""
          fill
          sizes={compact ? "80px" : "128px"}
          className="object-cover opacity-90"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent"
        />
      </div>
      <div className="max-w-xs space-y-1">
        <p className="text-sm font-medium tracking-tight">{title}</p>
        {description && (
          <p className="font-mono text-[11px] leading-relaxed tracking-wide text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
