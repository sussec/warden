"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportType } from "@/client/types.gen";

const TYPES: { type: ExportType; label: string; ext: string }[] = [
  { type: "Pdf", label: "PDF report", ext: "pdf" },
  { type: "Excel", label: "Excel", ext: "xlsx" },
  { type: "JSON", label: "JSON", ext: "json" },
];

/**
 * Per-commit report export (PDF/Excel/JSON) via the project export endpoint.
 * Session travels in httpOnly cookies; blob streamed via createObjectURL.
 */
export function ReportExportMenu({
  projectId,
  commitId,
}: {
  projectId: string;
  commitId: string;
}) {
  const [loading, setLoading] = useState(false);

  async function onExport(exportType: ExportType, ext: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/project/${projectId}/export?exportType=${exportType}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, commitId }),
        },
      );
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report_${commitId.slice(0, 8)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={loading}
          aria-label="Export commit report"
        >
          <Download className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {TYPES.map((t) => (
          <DropdownMenuItem key={t.type} onClick={() => onExport(t.type, t.ext)}>
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
