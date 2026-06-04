"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportType, FindingFilter } from "@/client/types.gen";

const EXPORT_OPTIONS: { type: ExportType; label: string; ext: string }[] = [
  { type: "Excel", label: "Excel (.xlsx)", ext: "xlsx" },
];

/**
 * Triggers a finding export and downloads the resulting blob.
 *
 * The generated sdk op parses responses as JSON, which corrupts binary
 * payloads — so we issue a raw fetch with the bearer token and stream the
 * blob through URL.createObjectURL, honoring any content-disposition filename.
 */
export function FindingExportMenu({ filter }: { filter: FindingFilter }) {
  const [loading, setLoading] = useState(false);

  async function onExport(exportType: ExportType, ext: string) {
    setLoading(true);
    try {
      // session travels in httpOnly cookies (same-origin)
      const res = await fetch("/api/finding/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filter),
      });
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const fallback = `${format(new Date(), "yyyyMMddHHmmss")}_export.${ext}`;
      const filename = filenameFromDisposition(
        res.headers.get("content-disposition"),
        fallback,
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {EXPORT_OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.type}
            onSelect={() => void onExport(opt.type, opt.ext)}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  // RFC 5987 filename* takes precedence, then plain filename.
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/["']/g, "").trim());
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1]?.trim() || fallback;
}
